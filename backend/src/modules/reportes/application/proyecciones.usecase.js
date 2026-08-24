const { randomUUID } = require('node:crypto');

function mesesEntre(desde, hasta) {
  const meses = [];
  const cursor = new Date(Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth(), 1));
  const fin = new Date(Date.UTC(hasta.getUTCFullYear(), hasta.getUTCMonth(), 1));
  while (cursor <= fin) {
    meses.push({ anio: cursor.getUTCFullYear(), mes: cursor.getUTCMonth() + 1 });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return meses;
}

function claveMes(fecha) {
  const fechaUtc = new Date(fecha);
  return `${fechaUtc.getUTCFullYear()}-${fechaUtc.getUTCMonth() + 1}`;
}

function rangoUltimosMeses(hasta = new Date(), cantidad = 24) {
  const fin = new Date(hasta);
  const inicio = new Date(Date.UTC(fin.getUTCFullYear(), fin.getUTCMonth() - cantidad + 1, 1));
  return { desde: inicio, hasta: fin };
}

async function refrescarAsistencia({ prisma, desde, hasta }) {
  const meses = mesesEntre(desde, hasta);
  if (!meses.length) return { asistencia: 0 };

  const filas = await prisma.registroAsistencia.findMany({
    where: { fecha: { gte: desde, lte: hasta } },
    select: {
      empleadoId: true,
      fecha: true,
      estadoDia: true,
      minutosTardanza: true,
      empleado: { select: { puesto: { select: { departamento_id: true } } } },
    },
  });

  const acumulado = new Map();
  for (const fila of filas) {
    const clave = `${fila.empleadoId}:${claveMes(fila.fecha)}`;
    const actual = acumulado.get(clave) ?? {
      empleadoId: fila.empleadoId,
      departamentoId: fila.empleado.puesto.departamento_id,
      anio: new Date(fila.fecha).getUTCFullYear(),
      mes: new Date(fila.fecha).getUTCMonth() + 1,
      diasPresente: 0,
      diasAusente: 0,
      diasTardanza: 0,
      minutosTardanza: 0,
    };
    if (['PRESENTE', 'TARDANZA'].includes(fila.estadoDia)) actual.diasPresente += 1;
    if (fila.estadoDia === 'AUSENTE') actual.diasAusente += 1;
    if (fila.estadoDia === 'TARDANZA' || fila.minutosTardanza > 0) actual.diasTardanza += 1;
    actual.minutosTardanza += fila.minutosTardanza ?? 0;
    acumulado.set(clave, actual);
  }

  await prisma.proyeccionAsistenciaMensual.deleteMany({ where: { OR: meses } });
  for (const fila of acumulado.values()) {
    const totalObservado = fila.diasPresente + fila.diasAusente;
    await prisma.proyeccionAsistenciaMensual.create({
      data: {
        id: randomUUID(),
        ...fila,
        pctAusentismo: totalObservado ? Number(((fila.diasAusente / totalObservado) * 100).toFixed(2)) : 0,
      },
    });
  }
  return { asistencia: acumulado.size, meses: meses.length };
}

async function refrescarCostoPlanilla({ prisma, desde, hasta }) {
  const meses = mesesEntre(desde, hasta);
  if (!meses.length) return { costos: 0 };
  const periodos = await prisma.periodoPlanilla.findMany({
    where: {
      estado: { in: ['CERRADA', 'PAGADA'] },
      fechaPago: { gte: desde, lte: hasta },
    },
    select: {
      fechaPago: true,
      detalles: {
        select: {
          empleadoId: true,
          totalIngresosCent: true,
          totalDeduccionesCent: true,
          netoPagarCent: true,
          totalAportesPatronalesCent: true,
          empleado: { select: { puesto: { select: { departamento_id: true } } } },
        },
      },
    },
  });

  const acumulado = new Map();
  for (const periodo of periodos) {
    const fecha = new Date(periodo.fechaPago);
    const anio = fecha.getUTCFullYear();
    const mes = fecha.getUTCMonth() + 1;
    for (const detalle of periodo.detalles) {
      const departamentoId = detalle.empleado.puesto.departamento_id;
      const clave = `${departamentoId}:${anio}-${mes}`;
      const actual = acumulado.get(clave) ?? {
        departamentoId,
        anio,
        mes,
        empleadosSet: new Set(),
        totalBrutoCent: 0,
        totalDeduccionesCent: 0,
        totalNetoCent: 0,
        totalAportesCent: 0,
      };
      actual.empleadosSet.add(detalle.empleadoId);
      actual.totalBrutoCent += detalle.totalIngresosCent;
      actual.totalDeduccionesCent += detalle.totalDeduccionesCent;
      actual.totalNetoCent += detalle.netoPagarCent;
      actual.totalAportesCent += detalle.totalAportesPatronalesCent;
      acumulado.set(clave, actual);
    }
  }

  await prisma.proyeccionCostoPlanilla.deleteMany({ where: { OR: meses } });
  for (const fila of acumulado.values()) {
    await prisma.proyeccionCostoPlanilla.create({
      data: {
        id: randomUUID(),
        departamentoId: fila.departamentoId,
        anio: fila.anio,
        mes: fila.mes,
        empleados: fila.empleadosSet.size,
        totalBrutoCent: fila.totalBrutoCent,
        totalDeduccionesCent: fila.totalDeduccionesCent,
        totalNetoCent: fila.totalNetoCent,
        totalAportesCent: fila.totalAportesCent,
      },
    });
  }
  return { costos: acumulado.size, meses: meses.length };
}

async function refrescarProyecciones(ctx, rango = rangoUltimosMeses(ctx.clock?.ahora?.() ?? new Date())) {
  const [asistencia, costo] = await Promise.all([
    refrescarAsistencia({ prisma: ctx.prisma, ...rango }),
    refrescarCostoPlanilla({ prisma: ctx.prisma, ...rango }),
  ]);
  return { ...asistencia, ...costo, desde: rango.desde, hasta: rango.hasta };
}

module.exports = { mesesEntre, rangoUltimosMeses, refrescarAsistencia, refrescarCostoPlanilla, refrescarProyecciones };
