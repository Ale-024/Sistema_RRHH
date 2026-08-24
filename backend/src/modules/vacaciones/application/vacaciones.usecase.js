const { ErrorAplicacion } = require('../../../shared/dominio/errores');
const { SolicitudVacacion } = require('../domain/solicitud-vacacion');

function inicioDelDia(fecha) {
  const valor = new Date(fecha);
  return new Date(Date.UTC(valor.getUTCFullYear(), valor.getUTCMonth(), valor.getUTCDate()));
}

function finDelDia(fecha) {
  const resultado = inicioDelDia(fecha);
  resultado.setUTCHours(23, 59, 59, 999);
  return resultado;
}

function aniversario(fechaIngreso, anio) {
  const ingreso = new Date(fechaIngreso);
  const fecha = new Date(Date.UTC(ingreso.getUTCFullYear(), ingreso.getUTCMonth(), ingreso.getUTCDate()));
  fecha.setUTCFullYear(ingreso.getUTCFullYear() + anio);
  return inicioDelDia(fecha);
}

function aniosServicioCumplidos(fechaIngreso, fechaCorte) {
  const ingreso = inicioDelDia(fechaIngreso);
  const corte = inicioDelDia(fechaCorte);
  let anios = corte.getFullYear() - ingreso.getFullYear();
  const aniversarioEsteAnio = aniversario(ingreso, anios);
  if (aniversarioEsteAnio > corte) anios -= 1;
  return Math.max(0, anios);
}

function diasDerecho(anioServicio, parametros) {
  if (anioServicio < 1) return 0;
  const clave = anioServicio >= 4 ? 'VAC_DIAS_ANIO_4' : `VAC_DIAS_ANIO_${anioServicio}`;
  const valor = Number(parametros[clave]);
  if (!Number.isFinite(valor) || valor < 0) {
    throw new ErrorAplicacion(
      'PARAMETRO_LEGAL_AUSENTE',
      500,
      `No existe un parametro legal valido para ${clave}.`
    );
  }
  return valor;
}

function diasHabilesEntre(inicio, fin) {
  let total = 0;
  const cursor = inicioDelDia(inicio);
  const limite = inicioDelDia(fin);
  while (cursor <= limite) {
    if (cursor.getUTCDay() !== 0 && cursor.getUTCDay() !== 6) total += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return total;
}

function validarRango(inicio, fin) {
  if (!(inicio instanceof Date) || Number.isNaN(inicio.getTime())) {
    throw new ErrorAplicacion('DATOS_INVALIDOS', 422, 'La fecha inicial no es valida.');
  }
  if (!(fin instanceof Date) || Number.isNaN(fin.getTime())) {
    throw new ErrorAplicacion('DATOS_INVALIDOS', 422, 'La fecha final no es valida.');
  }
  if (finDelDia(fin) < inicioDelDia(inicio)) {
    throw new ErrorAplicacion('RANGO_INVALIDO', 422, 'La fecha final no puede ser anterior a la inicial.');
  }
}

async function parametrosVigentes(tx, fecha) {
  const parametros = await tx.parametroLegal.findMany({
    where: { activo: true },
    orderBy: { vigenciaDesde: 'desc' },
  });
  const resultado = {};
  for (const parametro of parametros) {
    const desde = new Date(parametro.vigenciaDesde);
    const hasta = parametro.vigenciaHasta ? new Date(parametro.vigenciaHasta) : null;
    if (desde > fecha || (hasta && hasta < fecha)) continue;
    if (!(parametro.clave in resultado)) resultado[parametro.clave] = parametro.valor;
  }
  return resultado;
}

async function sumaMovimientos(tx, periodoId) {
  const agregado = await tx.movimientoSaldoVacacion.aggregate({
    where: { periodoId },
    _sum: { dias: true },
  });
  return Number(agregado._sum.dias ?? 0);
}

async function devengarVacaciones({ prisma, fecha = new Date(), empleadoId = null }) {
  const corte = inicioDelDia(fecha);
  return prisma.$transaction(async (tx) => {
    const parametros = await parametrosVigentes(tx, corte);
    const empleados = await tx.empleado.findMany({
      where: { estadoLaboral: 'ACTIVO', ...(empleadoId ? { id: empleadoId } : {}) },
      select: { id: true, fecha_ingreso: true },
    });
    let creados = 0;
    for (const empleado of empleados) {
      const anios = aniosServicioCumplidos(empleado.fecha_ingreso, corte);
      for (let anio = 1; anio <= anios; anio += 1) {
        const derecho = diasDerecho(anio, parametros);
        const periodo = await tx.periodoVacacional.upsert({
          where: { empleadoId_anioServicio: { empleadoId: empleado.id, anioServicio: anio } },
          update: {},
          create: {
            empleadoId: empleado.id,
            anioServicio: anio,
            desde: aniversario(empleado.fecha_ingreso, anio - 1),
            hasta: aniversario(empleado.fecha_ingreso, anio),
            diasDerecho: derecho,
          },
        });
        const existeDevengo = await tx.movimientoSaldoVacacion.findFirst({
          where: { periodoId: periodo.id, tipo: 'DEVENGO' },
          select: { id: true },
        });
        if (!existeDevengo) {
          await tx.movimientoSaldoVacacion.create({
            data: {
              periodoId: periodo.id,
              tipo: 'DEVENGO',
              dias: derecho,
              motivo: `Devengo por ${anio} año(s) de servicio`,
            },
          });
          creados += 1;
        }
      }
    }
    return { fecha: corte.toISOString().slice(0, 10), periodosCreados: creados };
  });
}

function opcionesSolicitud() {
  return {
    periodo: { include: { movimientos: true } },
    suplente: { select: { id: true, nombres: true, apellidos: true } },
    historial: { orderBy: { ocurridoEn: 'asc' } },
  };
}

async function obtenerSaldo(tx, periodoId) {
  return sumaMovimientos(tx, periodoId);
}

async function crearSolicitudVacacion({ prisma, empleadoId, usuarioId, datos, ip }) {
  const fechaInicio = inicioDelDia(datos.fechaInicio);
  const fechaFin = inicioDelDia(datos.fechaFin);
  validarRango(fechaInicio, fechaFin);
  const dias = diasHabilesEntre(fechaInicio, fechaFin);
  if (dias < 1) throw new ErrorAplicacion('RANGO_SIN_DIAS_HABILES', 422, 'El rango no contiene dias habiles.');

  return prisma.$transaction(async (tx) => {
    const periodo = await tx.periodoVacacional.findFirst({
      where: {
        id: datos.periodoId,
        empleadoId,
        desde: { lte: fechaInicio },
        hasta: { gte: fechaFin },
        estado: 'VIGENTE',
      },
    });
    if (!periodo) throw new ErrorAplicacion('PERIODO_VACACIONAL_INVALIDO', 422, 'El rango no pertenece a un periodo vigente propio.');
    if (datos.suplenteId === empleadoId) throw new ErrorAplicacion('SUPLENTE_INVALIDO', 422, 'El suplente debe ser otra persona.');
    if (datos.suplenteId) {
      const suplente = await tx.empleado.findFirst({ where: { id: datos.suplenteId, estadoLaboral: 'ACTIVO' }, select: { id: true } });
      if (!suplente) throw new ErrorAplicacion('SUPLENTE_INVALIDO', 422, 'El suplente no existe o no esta activo.');
    }
    const saldo = await obtenerSaldo(tx, periodo.id);
    if (saldo < dias) throw new ErrorAplicacion('SALDO_VACACIONES_INSUFICIENTE', 409, 'El saldo vacacional disponible es insuficiente.');
    const folio = `VAC-${fechaInicio.getFullYear()}-${Date.now().toString().slice(-8)}`;
    const solicitud = await tx.solicitudVacacion.create({
      data: {
        folio,
        empleadoId,
        periodoId: periodo.id,
        fechaInicio,
        fechaFin,
        diasHabiles: dias,
        suplenteId: datos.suplenteId ?? null,
        historial: { create: { estadoNuevo: 'SOLICITADO', usuarioId, ip: ip ?? null } },
      },
      include: opcionesSolicitud(),
    });
    return solicitud;
  });
}

async function cambiarEstadoVacacion({ prisma, id, destino, usuarioId, motivo, ip, ahora = new Date() }) {
  return prisma.$transaction(async (tx) => {
    const solicitud = await tx.solicitudVacacion.findUnique({ where: { id }, include: { periodo: true } });
    if (!solicitud) throw new ErrorAplicacion('RECURSO_NO_ENCONTRADO', 404, 'Solicitud de vacaciones no encontrada.');
    const agregado = new SolicitudVacacion(solicitud);
    agregado.transicionar(destino);
    if (['RECHAZADO', 'SOLICITADO'].includes(destino) && !motivo?.trim()) {
      throw new ErrorAplicacion('MOTIVO_REQUERIDO', 422, 'Se requiere un motivo para esta transicion.');
    }
    if (destino === 'APROBADO') {
      const saldo = await obtenerSaldo(tx, solicitud.periodoId);
      if (saldo < solicitud.diasHabiles) {
        throw new ErrorAplicacion('SALDO_VACACIONES_INSUFICIENTE', 409, 'El saldo vacacional disponible es insuficiente.');
      }
      const diasCerrados = await tx.registroAsistencia.count({
        where: { empleadoId: solicitud.empleadoId, fecha: { gte: inicioDelDia(solicitud.fechaInicio), lte: finDelDia(solicitud.fechaFin) }, cerrado: true },
      });
      if (diasCerrados > 0) throw new ErrorAplicacion('ASISTENCIA_CERRADA', 409, 'El rango contiene dias de asistencia cerrados.');
    }
    const actualizado = await tx.solicitudVacacion.update({
      where: { id },
      data: {
        estado: destino,
        revisadoPor: usuarioId,
        revisadoEn: ahora,
        observacionRevision: motivo ?? null,
        historial: { create: { estadoAnterior: solicitud.estado, estadoNuevo: destino, usuarioId, motivo: motivo ?? null, ip: ip ?? null } },
      },
      include: opcionesSolicitud(),
    });
    if (destino === 'APROBADO') {
      await tx.movimientoSaldoVacacion.create({
        data: { periodoId: solicitud.periodoId, tipo: 'GOCE', dias: -solicitud.diasHabiles, referenciaId: id, registradoPor: usuarioId, motivo: motivo ?? 'Goce vacacional aprobado' },
      });
      const saldoRestante = await obtenerSaldo(tx, solicitud.periodoId);
      await tx.periodoVacacional.update({
        where: { id: solicitud.periodoId },
        data: { diasGozados: { increment: solicitud.diasHabiles }, estado: saldoRestante <= 0 ? 'AGOTADO' : 'VIGENTE' },
      });
      for (let cursor = inicioDelDia(solicitud.fechaInicio); cursor <= inicioDelDia(solicitud.fechaFin); cursor.setUTCDate(cursor.getUTCDate() + 1)) {
        if (cursor.getUTCDay() === 0 || cursor.getUTCDay() === 6) continue;
        await tx.registroAsistencia.upsert({
          where: { empleadoId_fecha: { empleadoId: solicitud.empleadoId, fecha: new Date(cursor) } },
          update: { estadoDia: 'VACACION', vacacionId: id },
          create: { empleadoId: solicitud.empleadoId, fecha: new Date(cursor), estadoDia: 'VACACION', vacacionId: id },
        });
      }
    }
    return actualizado;
  });
}

module.exports = {
  aniosServicioCumplidos,
  aniversario,
  cambiarEstadoVacacion,
  crearSolicitudVacacion,
  diasDerecho,
  diasHabilesEntre,
  devengarVacaciones,
  finDelDia,
  inicioDelDia,
  opcionesSolicitud,
  parametrosVigentes,
  sumaMovimientos,
  validarRango,
};
