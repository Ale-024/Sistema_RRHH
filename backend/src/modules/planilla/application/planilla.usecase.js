const crypto = require('node:crypto');
const { ErrorAplicacion } = require('../../../shared/dominio/errores');
const { PeriodoPlanilla } = require('../domain/periodo-planilla');
const { calcularDetalle } = require('../domain/nomina-core/calcular-detalle');

const CALCULOS_EN_CURSO = new Set();

function inicioDelDia(fecha) {
  const valor = new Date(fecha);
  return new Date(Date.UTC(valor.getUTCFullYear(), valor.getUTCMonth(), valor.getUTCDate()));
}

function finDelDia(fecha) {
  const valor = inicioDelDia(fecha);
  valor.setUTCHours(23, 59, 59, 999);
  return valor;
}

function diasLaborables(inicio, fin) {
  let total = 0;
  const cursor = inicioDelDia(inicio);
  const limite = inicioDelDia(fin);
  while (cursor <= limite) {
    if (cursor.getUTCDay() !== 0 && cursor.getUTCDay() !== 6) total += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return total;
}

function validarRango(fechaInicio, fechaFin) {
  if (!(fechaInicio instanceof Date) || Number.isNaN(fechaInicio.getTime()) || !(fechaFin instanceof Date) || Number.isNaN(fechaFin.getTime())) {
    throw new ErrorAplicacion('DATOS_INVALIDOS', 422, 'Las fechas del periodo no son validas.');
  }
  if (finDelDia(fechaFin) < inicioDelDia(fechaInicio)) {
    throw new ErrorAplicacion('PLANILLA_RANGO_INVALIDO', 422, 'La fecha final no puede ser anterior a la inicial.');
  }
}

async function parametrosVigentes(tx, fecha) {
  const todos = await tx.parametroLegal.findMany({ where: { activo: true }, orderBy: { vigenciaDesde: 'desc' } });
  const resultado = {};
  for (const parametro of todos) {
    const desde = new Date(parametro.vigenciaDesde);
    const hasta = parametro.vigenciaHasta ? new Date(parametro.vigenciaHasta) : null;
    if (desde <= fecha && (!hasta || hasta >= fecha) && !(parametro.clave in resultado)) resultado[parametro.clave] = parametro.valor;
  }
  return resultado;
}

function fechaDentro(fecha, inicio, fin) {
  const valor = new Date(fecha);
  return valor >= inicio && valor <= fin;
}

function contratoVigente(contratos, inicio, fin) {
  return [...contratos]
    .filter((contrato) => new Date(contrato.vigenciaDesde) <= fin && (!contrato.vigenciaHasta || new Date(contrato.vigenciaHasta) >= inicio))
    .sort((a, b) => new Date(b.vigenciaDesde) - new Date(a.vigenciaDesde))[0] ?? null;
}

async function crearPeriodoPlanilla({ prisma, datos, usuarioId }) {
  const fechaInicio = inicioDelDia(datos.fechaInicio);
  const fechaFin = inicioDelDia(datos.fechaFin);
  const fechaPago = inicioDelDia(datos.fechaPago);
  validarRango(fechaInicio, fechaFin);
  if (fechaPago < fechaFin) throw new ErrorAplicacion('PLANILLA_FECHA_PAGO_INVALIDA', 422, 'La fecha de pago debe ser igual o posterior al periodo.');
  return prisma.$transaction(async (tx) => {
    if (datos.periodoAjusteDeId) {
      const base = await tx.periodoPlanilla.findUnique({ where: { id: datos.periodoAjusteDeId }, select: { estado: true } });
      if (!base || base.estado !== 'CERRADA' && base.estado !== 'PAGADA') throw new ErrorAplicacion('AJUSTE_REQUIERE_CIERRE', 422, 'El periodo base del ajuste debe estar cerrado.');
    }
    return tx.periodoPlanilla.create({
      data: {
        codigo: datos.codigo,
        tipo: datos.tipo ?? 'ORDINARIA',
        periodicidad: datos.periodicidad ?? 'MENSUAL',
        fechaInicio,
        fechaFin,
        fechaPago,
        periodoAjusteDeId: datos.periodoAjusteDeId ?? null,
        calculadoPor: usuarioId ?? null,
      },
    });
  });
}

async function calcularPeriodoPlanilla({ prisma, periodoId, usuarioId }) {
  if (CALCULOS_EN_CURSO.has(periodoId)) throw new ErrorAplicacion('CALCULO_EN_CURSO', 409, 'El periodo ya tiene un calculo en curso.');
  CALCULOS_EN_CURSO.add(periodoId);
  try {
    return await prisma.$transaction(async (tx) => {
      const periodo = await tx.periodoPlanilla.findUnique({ where: { id: periodoId } });
      if (!periodo) throw new ErrorAplicacion('NO_ENCONTRADO', 404, 'Periodo de planilla no encontrado.');
      if (!['BORRADOR', 'CALCULADA'].includes(periodo.estado)) throw new ErrorAplicacion('PLANILLA_ESTADO_NO_CALCULABLE', 409, 'Solo se pueden calcular periodos en borrador o calculados.');
      const fechaInicio = inicioDelDia(periodo.fechaInicio);
      const fechaFin = finDelDia(periodo.fechaFin);
      const parametros = await parametrosVigentes(tx, fechaFin);
      const empleados = await tx.empleado.findMany({ where: { estadoLaboral: { not: 'INACTIVO' } }, select: { id: true, nombres: true, apellidos: true, estadoLaboral: true } });
      const ids = empleados.map((empleado) => empleado.id);
      const contratos = ids.length ? await tx.contrato.findMany({ where: { empleado_id: { in: ids } } }) : [];
      const asistencias = ids.length ? await tx.registroAsistencia.findMany({ where: { empleadoId: { in: ids } } }) : [];
      const conceptos = await tx.concepto.findMany({ where: { activo: true } });
      const conceptoPorCodigo = new Map(conceptos.map((concepto) => [concepto.codigo, concepto]));
      const diasPeriodo = diasLaborables(fechaInicio, fechaFin);
      const detalles = [];
      for (const empleado of empleados) {
        const contrato = contratoVigente(contratos.filter((item) => item.empleado_id === empleado.id), fechaInicio, fechaFin);
        if (!contrato) continue;
        const registros = asistencias.filter((registro) => registro.empleadoId === empleado.id && fechaDentro(registro.fecha, fechaInicio, fechaFin));
        const diasAusenciaInjustificada = registros.filter((registro) => registro.estadoDia === 'AUSENTE').length;
        const diasTrabajados = registros.filter((registro) => ['PRESENTE', 'TARDANZA', 'PERMISO', 'VACACION', 'FERIADO'].includes(registro.estadoDia)).length;
        const vacacionesGozadas = registros.filter((registro) => registro.estadoDia === 'VACACION').length;
        const permisosRemunerados = registros.filter((registro) => registro.estadoDia === 'PERMISO').length;
        const horasExtraDiurnas = registros.reduce((total, registro) => total + Number(registro.horasExtraDiurnas || 0), 0);
        const horasExtraNocturnas = registros.reduce((total, registro) => total + Number(registro.horasExtraNocturnas || 0), 0);
        const detalle = calcularDetalle({
          empleado,
          contrato,
          periodo: { ...periodo, diasPeriodo, proporcionAnual: 1, proporcionLiquidacion: 1 },
          parametros,
          asistencia: {
            diasPeriodo,
            diasTrabajados,
            diasAusenciaInjustificada,
            diasPagables: diasPeriodo - diasAusenciaInjustificada,
            horasExtraDiurnas,
            horasExtraNocturnas,
            horasJornada: 8,
            horasEfectivas: registros.reduce((total, registro) => total + Number(registro.minutosTrabajados || 0) / 60, 0),
          },
          vacacionesGozadas: { dias: vacacionesGozadas },
          permisosRemunerados: { dias: permisosRemunerados },
        });
        detalles.push({ empleado, contrato, detalle });
      }
      await tx.detallePlanilla.deleteMany({ where: { periodoId } });
      for (const item of detalles) {
        const detalle = await tx.detallePlanilla.create({
          data: {
            periodoId,
            empleadoId: item.empleado.id,
            contratoSnapshot: JSON.stringify({ id: item.contrato.id, empleado_id: item.contrato.empleado_id, modalidad: item.contrato.modalidad, salarioBaseCent: item.contrato.salarioBaseCent, periodicidad: item.contrato.periodicidad, aplicaIhss: item.contrato.aplicaIhss, aplicaRap: item.contrato.aplicaRap }),
            parametrosSnapshot: JSON.stringify(parametros),
            diasTrabajados: item.detalle.diasTrabajados,
            horasExtra: item.detalle.horasExtra,
            totalIngresosCent: item.detalle.totalIngresosCent,
            totalDeduccionesCent: item.detalle.totalDeduccionesCent,
            totalAportesPatronalesCent: item.detalle.totalAportesPatronalesCent,
            netoPagarCent: item.detalle.netoPagarCent,
            lineas: { create: item.detalle.lineas.map((linea) => ({ conceptoId: conceptoPorCodigo.get(linea.conceptoCodigo)?.id, baseCalculoCent: linea.baseCalculoCent, cantidad: linea.cantidad, montoCent: linea.montoCent, detalleCalculo: linea.detalleCalculo })) },
          },
        });
        if (detalle.lineas?.length === 0) throw new ErrorAplicacion('CONCEPTO_AUSENTE', 500, 'El catalogo de conceptos no esta completo.');
      }
      const totales = detalles.reduce((total, item) => ({
        bruto: total.bruto + item.detalle.totalIngresosCent,
        deducciones: total.deducciones + item.detalle.totalDeduccionesCent,
        neto: total.neto + item.detalle.netoPagarCent,
        aportes: total.aportes + item.detalle.totalAportesPatronalesCent,
      }), { bruto: 0, deducciones: 0, neto: 0, aportes: 0 });
      return tx.periodoPlanilla.update({ where: { id: periodoId }, data: { estado: 'CALCULADA', totalBrutoCent: totales.bruto, totalDeduccionesCent: totales.deducciones, totalNetoCent: totales.neto, totalAportesPatronalesCent: totales.aportes, calculadoPor: usuarioId ?? null, calculadoEn: new Date(), errorCalculo: null }, include: { detalles: { include: { empleado: true, lineas: { include: { concepto: true } } } } } });
    });
  } catch (error) {
    try { await prisma.periodoPlanilla.update({ where: { id: periodoId }, data: { errorCalculo: error.message } }); } catch { /* conserva el error original */ }
    throw error;
  } finally {
    CALCULOS_EN_CURSO.delete(periodoId);
  }
}

function hashPeriodo(periodo) {
  const canonico = {
    id: periodo.id,
    codigo: periodo.codigo,
    fechaInicio: periodo.fechaInicio,
    fechaFin: periodo.fechaFin,
    fechaPago: periodo.fechaPago,
    totalBrutoCent: periodo.totalBrutoCent,
    totalDeduccionesCent: periodo.totalDeduccionesCent,
    totalNetoCent: periodo.totalNetoCent,
    totalAportesPatronalesCent: periodo.totalAportesPatronalesCent,
    detalles: [...(periodo.detalles ?? [])].sort((a, b) => a.empleadoId - b.empleadoId).map((detalle) => ({ empleadoId: detalle.empleadoId, totalIngresosCent: detalle.totalIngresosCent, totalDeduccionesCent: detalle.totalDeduccionesCent, totalAportesPatronalesCent: detalle.totalAportesPatronalesCent, netoPagarCent: detalle.netoPagarCent, lineas: [...(detalle.lineas ?? [])].sort((a, b) => a.conceptoId - b.conceptoId).map((linea) => ({ conceptoId: linea.conceptoId, baseCalculoCent: linea.baseCalculoCent, cantidad: linea.cantidad, montoCent: linea.montoCent, detalleCalculo: linea.detalleCalculo })) })),
  };
  return crypto.createHash('sha256').update(JSON.stringify(canonico)).digest('hex');
}

async function transicionarPeriodo({ prisma, periodoId, destino, usuarioId, motivo }) {
  return prisma.$transaction(async (tx) => {
    const periodo = await tx.periodoPlanilla.findUnique({ where: { id: periodoId }, include: { detalles: { include: { lineas: true } } } });
    if (!periodo) throw new ErrorAplicacion('NO_ENCONTRADO', 404, 'Periodo de planilla no encontrado.');
    new PeriodoPlanilla(periodo).transicionar(destino);
    if (destino === 'CALCULADA' && periodo.estado === 'EN_APROBACION' && !motivo?.trim()) throw new ErrorAplicacion('MOTIVO_REQUERIDO', 422, 'El motivo de devolución es obligatorio.');
    if (destino === 'CERRADA') {
      if (!periodo.detalles.length) throw new ErrorAplicacion('PLANILLA_SIN_DETALLE', 422, 'No se puede cerrar un periodo sin detalles.');
      const hashCierre = hashPeriodo(periodo);
      return tx.periodoPlanilla.update({ where: { id: periodoId }, data: { estado: destino, cerradoPor: usuarioId, cerradoEn: new Date(), hashCierre } });
    }
    if (destino === 'PAGADA') return tx.periodoPlanilla.update({ where: { id: periodoId }, data: { estado: destino, pagadoPor: usuarioId, pagadoEn: new Date() } });
    return tx.periodoPlanilla.update({ where: { id: periodoId }, data: { estado: destino, errorCalculo: destino === 'CALCULADA' ? motivo ?? null : null } });
  });
}

async function crearPeriodoAjuste({ prisma, periodoId, usuarioId, datos }) {
  const base = await prisma.periodoPlanilla.findUnique({ where: { id: periodoId } });
  if (!base || !['CERRADA', 'PAGADA'].includes(base.estado)) throw new ErrorAplicacion('AJUSTE_REQUIERE_CIERRE', 422, 'El periodo base debe estar cerrado o pagado.');
  return crearPeriodoPlanilla({ prisma, usuarioId, datos: { ...datos, tipo: 'AJUSTE', periodicidad: base.periodicidad, fechaInicio: datos.fechaInicio ?? base.fechaInicio, fechaFin: datos.fechaFin ?? base.fechaFin, fechaPago: datos.fechaPago ?? base.fechaPago, periodoAjusteDeId: periodoId, codigo: datos.codigo ?? `AJ-${base.codigo}-${Date.now().toString().slice(-6)}` } });
}

async function obtenerPeriodo(prisma, id) {
  return prisma.periodoPlanilla.findUnique({ where: { id }, include: { detalles: { include: { empleado: true, lineas: { include: { concepto: true } } } }, periodoAjusteDe: true, ajustes: true } });
}

module.exports = { CALCULOS_EN_CURSO, calcularPeriodoPlanilla, crearPeriodoAjuste, crearPeriodoPlanilla, diasLaborables, hashPeriodo, inicioDelDia, parametrosVigentes, obtenerPeriodo, transicionarPeriodo, validarRango };
