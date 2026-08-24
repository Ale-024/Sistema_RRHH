
/**
 * CU02 - Consolidado diario deterministico.
 * Convierte marcajes crudos en RegistroAsistencia aplicando el turno
 * asignado (tolerancia, almuerzo, jornada) y los feriados cargados.
 *
 * Propiedades verificadas por pruebas:
 * - Deterministico: la misma entrada produce siempre la misma salida.
 * - Idempotente: reejecutar el mismo dia no altera resultados.
 * - Un dia cerrado nunca se recalcula (ademas lo bloquea un trigger).
 */
function minutosDeDia(fecha) {
  return fecha.getHours() * 60 + fecha.getMinutes();
}

function minutosDesdeHHMM(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function resolverHorario(empleado, horariosPorEmpleado, fecha) {
  const lista = horariosPorEmpleado.get(empleado.id) ?? [];
  return lista.find((h) => {
    const desde = new Date(h.desde);
    const hasta = h.hasta ? new Date(h.hasta) : null;
    return desde <= fecha && (!hasta || fecha <= hasta);
  });
}

async function consolidarDia(fechaObjetivo, ctx) {
  const { prisma } = ctx;
  const inicio = new Date(fechaObjetivo.getFullYear(), fechaObjetivo.getMonth(), fechaObjetivo.getDate());
  const fin = new Date(inicio);
  fin.setDate(fin.getDate() + 1);

  const diaSemanaISO = inicio.getDay() === 0 ? 7 : inicio.getDay(); // ISO: lunes=1

  const [empleadosActivos, horarios, feriado, marcajesDelDia, solicitudesAprobadas] =
    await Promise.all([
      prisma.empleado.findMany({ where: { estadoLaboral: 'ACTIVO' }, select: { id: true } }),
      prisma.horarioEmpleado.findMany({
        where: { desde: { lte: inicio } },
        include: { turno: true },
        orderBy: { desde: 'desc' },
      }),
      prisma.diaFeriado.findUnique({ where: { fecha: inicio } }),
      prisma.marcaje.findMany({
        where: { ocurridoEn: { gte: inicio, lt: fin } },
        orderBy: [{ empleadoId: 'asc' }, { ocurridoEn: 'asc' }],
      }),
      prisma.solicitud.findMany({
        where: { estado: 'APROBADA', fecha_inicio: { lt: fin }, fecha_fin: { gte: inicio } },
        select: { empleado_id: true, tipo: true },
      }),
    ]);

  const horariosPorEmpleado = new Map();
  for (const h of horarios) {
    if (!horariosPorEmpleado.has(h.empleadoId)) {
      horariosPorEmpleado.set(h.empleadoId, []);
    }
    horariosPorEmpleado.get(h.empleadoId).push(h);
  }

  const permisoPorEmpleado = new Map(
    solicitudesAprobadas.map((s) => [s.empleado_id, s.tipo])
  );

  let procesados = 0;
  for (const empleado of empleadosActivos) {
    // Un dia cerrado jamas se recalcula.
    const existente = await prisma.registroAsistencia.findUnique({
      where: { empleadoId_fecha: { empleadoId: empleado.id, fecha: inicio } },
    });
    if (existente?.cerrado) continue;

    const asignacion = resolverHorario(empleado, horariosPorEmpleado, inicio);
    const turno = asignacion?.turno ?? null;

    const marcajes = marcajesDelDia.filter((m) => m.empleadoId === empleado.id);
    const entrada = marcajes.find((m) => m.tipo === 'ENTRADA') ?? null;
    const salida = [...marcajes].reverse().find((m) => m.tipo === 'SALIDA' && entrada && m.ocurridoEn > entrada.ocurridoEn) ?? null;

    let estadoDia;
    let minutosTrabajados = 0;
    let minutosTardanza = 0;
    let horasExtraDiurnas = 0;
    let horasExtraNocturnas = 0;

    if (entrada && salida) {
      minutosTrabajados = Math.max(0, Math.round((salida.ocurridoEn - entrada.ocurridoEn) / 60_000));
      if (turno && minutosTrabajados > turno.minutosAlmuerzo) {
        minutosTrabajados -= turno.minutosAlmuerzo;
      }

      if (turno) {
        minutosTardanza = Math.max(
          0,
          minutosDeDia(entrada.ocurridoEn) -
            (minutosDesdeHHMM(turno.horaEntrada) + turno.toleranciaMin)
        );

        // Jornada teorica del turno; lo excedente son horas extra.
        const jornadaTeorica =
          (minutosDesdeHHMM(turno.horaSalida) - minutosDesdeHHMM(turno.horaEntrada)) -
          turno.minutosAlmuerzo;
        const extraTotalMin = Math.max(0, minutosTrabajados - Math.max(jornadaTeorica, 0));

        // Honduras: jornada diurna entre 05:00 y 19:00 (Codigo de Trabajo).
        const HORA_INICIO_DIURNA = 5 * 60;
        const HORA_FIN_DIURNA = 19 * 60;

        let cursor = new Date(entrada.ocurridoEn);
        const limiteExtra = extraTotalMin;
        let contadas = 0;
        while (contadas < limiteExtra) {
          const min = minutosDeDia(cursor);
          const esDiurna = min >= HORA_INICIO_DIURNA && min < HORA_FIN_DIURNA;
          if (esDiurna) horasExtraDiurnas += 1 / 60;
          else horasExtraNocturnas += 1 / 60;
          cursor = new Date(cursor.getTime() + 60_000);
          contadas++;
        }
      }

      if (feriado?.remunerado) estadoDia = 'FERIADO';
      else if (permisoPorEmpleado.get(empleado.id)) estadoDia = 'PERMISO';
      else estadoDia = minutosTardanza > 0 ? 'TARDANZA' : 'PRESENTE';
    } else if (entrada && !salida) {
      // Jornada incompleta: se registra como presente sin cierre aun.
      estadoDia = 'PRESENTE';
    } else if (feriado) {
      estadoDia = 'FERIADO';
    } else if (permisoPorEmpleado.get(empleado.id) === 'VACACIONES') {
      estadoDia = 'VACACION';
    } else if (permisoPorEmpleado.get(empleado.id)) {
      estadoDia = 'PERMISO';
    } else {
      const esDiaLaborable = turno ? turno.diasSemana.split(',').includes(String(diaSemanaISO)) : false;
      estadoDia = esDiaLaborable ? 'AUSENTE' : 'DESCANSO';
    }

    await prisma.registroAsistencia.upsert({
      where: { empleadoId_fecha: { empleadoId: empleado.id, fecha: inicio } },
      update: {
        turnoId: turno?.id ?? null,
        horaEntrada: entrada?.ocurridoEn ?? null,
        horaSalida: salida?.ocurridoEn ?? null,
        minutosTrabajados,
        minutosTardanza,
        horasExtraDiurnas,
        horasExtraNocturnas,
        estadoDia,
      },
      create: {
        empleadoId: empleado.id,
        fecha: inicio,
        turnoId: turno?.id ?? null,
        horaEntrada: entrada?.ocurridoEn ?? null,
        horaSalida: salida?.ocurridoEn ?? null,
        minutosTrabajados,
        minutosTardanza,
        horasExtraDiurnas,
        horasExtraNocturnas,
        estadoDia,
      },
    });
    procesados++;
  }

  return { fecha: inicio.toISOString().slice(0, 10), empleados: procesados };
}

module.exports = { consolidarDia };
