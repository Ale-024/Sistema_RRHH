/**
 * Motor puro de planilla. No importa Prisma, Express, reloj ni variables de
 * entorno. Todos los importes entran y salen como centavos enteros.
 */

function numero(valor, predeterminado = 0) {
  const resultado = Number(valor);
  return Number.isFinite(resultado) ? resultado : predeterminado;
}

function redondearCentavos(valor) {
  return Math.round(numero(valor));
}

function tasa(parametros, clave, predeterminada = 0) {
  return numero(parametros?.[clave], predeterminada);
}

function porcentajeCent(baseCent, porcentaje) {
  return redondearCentavos(baseCent * numero(porcentaje));
}

function diasPagables(asistencia, diasPeriodo) {
  const faltas = Math.max(0, numero(asistencia?.diasAusenciaInjustificada));
  return Math.max(0, numero(asistencia?.diasPagables, diasPeriodo - faltas));
}

function calcularIsr(ingresoGravableCent, parametros) {
  const anual = Math.max(0, ingresoGravableCent * 12);
  const exento = Math.max(0, numero(parametros?.ISR_EXENTO_ANUAL_CENT));
  const base = anual;
  let anterior = exento;
  let impuestoAnual = 0;
  for (let tramo = 1; tramo <= 10; tramo += 1) {
    const limite = numero(parametros?.[`ISR_TRAMO_${tramo}_LIMITE_ANUAL_CENT`], NaN);
    const porcentaje = numero(parametros?.[`ISR_TRAMO_${tramo}_TASA`], NaN);
    if (!Number.isFinite(limite) || !Number.isFinite(porcentaje)) break;
    const gravado = Math.max(0, Math.min(base, limite) - anterior);
    impuestoAnual += porcentajeCent(gravado, porcentaje);
    anterior = limite;
    if (base <= limite) return redondearCentavos(impuestoAnual / 12);
  }
  if (!Number.isFinite(anterior) || anterior === 0) return 0;
  const ultimoPorcentaje = numero(parametros?.ISR_TRAMO_10_TASA, 0);
  if (base > anterior && ultimoPorcentaje > 0) {
    impuestoAnual += porcentajeCent(base - anterior, ultimoPorcentaje);
  }
  return redondearCentavos(impuestoAnual / 12);
}

function calcularBaseOrdinaria(entrada) {
  const contrato = entrada.contrato ?? {};
  const asistencia = entrada.asistencia ?? {};
  const periodo = entrada.periodo ?? {};
  const dias = numero(periodo.diasPeriodo, 30);
  const pagables = diasPagables(asistencia, dias);
  const diasTrabajados = Math.max(0, numero(asistencia.diasTrabajados));
  const diasPagados = diasTrabajados + numero(entrada.vacacionesGozadas?.dias) + numero(entrada.permisosRemunerados?.dias);
  const modalidad = contrato.modalidad ?? 'PERMANENTE';
  const tarifa = numero(contrato.salarioBaseCent);

  if (periodo.tipo === 'DECIMO_TERCERO' || periodo.tipo === 'DECIMO_CUARTO') {
    return redondearCentavos(tarifa * numero(periodo.proporcionAnual, 1));
  }
  if (periodo.tipo === 'LIQUIDACION') {
    return redondearCentavos(tarifa * Math.max(0, numero(periodo.proporcionLiquidacion, 1)));
  }
  if (modalidad === 'POR_DIA') return redondearCentavos(tarifa * Math.max(diasTrabajados, diasPagados));
  if (modalidad === 'POR_HORA') return redondearCentavos(tarifa * numero(asistencia.horasEfectivas));
  if (modalidad === 'POR_PROYECTO') return redondearCentavos(tarifa * numero(asistencia.unidadesValidadas, diasTrabajados));
  return redondearCentavos((tarifa * pagables) / Math.max(dias, 1));
}

function linea(conceptoCodigo, tipo, baseCalculoCent, cantidad, montoCent, formula, parametros) {
  return {
    conceptoCodigo,
    tipo,
    baseCalculoCent: redondearCentavos(baseCalculoCent),
    cantidad: cantidad === undefined ? null : cantidad,
    montoCent: redondearCentavos(montoCent),
    detalleCalculo: JSON.stringify({ formula, parametros }),
  };
}

function calcularDetalle(entrada) {
  const contrato = entrada.contrato ?? {};
  const parametros = entrada.parametros ?? {};
  const periodo = entrada.periodo ?? {};
  const baseOrdinaria = calcularBaseOrdinaria(entrada);
  const diasPeriodo = Math.max(1, numero(periodo.diasPeriodo, 30));
  const horasJornada = Math.max(1, numero(entrada.asistencia?.horasJornada, 8));
  const baseHora = baseOrdinaria / (diasPeriodo * horasJornada);
  const extrasDiurnas = numero(entrada.asistencia?.horasExtraDiurnas);
  const extrasNocturnas = numero(entrada.asistencia?.horasExtraNocturnas);
  const lineas = [linea('SUELDO', 'INGRESO', baseOrdinaria, 1, baseOrdinaria, 'salarioBaseCent * diasPagables / diasPeriodo', parametros)];
  if (extrasDiurnas > 0) {
    lineas.push(linea('H_EXTRA_D', 'INGRESO', baseHora, extrasDiurnas, baseHora * extrasDiurnas * (1 + tasa(parametros, 'H_EXTRA_DIURNA_RECARGO')), 'baseHora * horas * (1 + recargo)', parametros));
  }
  if (extrasNocturnas > 0) {
    lineas.push(linea('H_EXTRA_N', 'INGRESO', baseHora, extrasNocturnas, baseHora * extrasNocturnas * (1 + tasa(parametros, 'H_EXTRA_NOCTURNA_RECARGO')), 'baseHora * horas * (1 + recargo)', parametros));
  }

  const ingresos = lineas.filter((item) => item.tipo === 'INGRESO').reduce((total, item) => total + item.montoCent, 0);
  const baseIhss = Math.min(ingresos, Math.max(0, numero(parametros.TECHO_IHSS)));
  const ihssTrabajador = contrato.aplicaIhss === false ? 0 : porcentajeCent(baseIhss, tasa(parametros, 'IHSS_EM_TRAB') + tasa(parametros, 'IHSS_IVM_TRAB'));
  const rapBase = Math.max(0, ingresos - Math.max(0, numero(parametros.RAP_PISO_CENT)));
  const rapTrabajador = contrato.aplicaRap === false ? 0 : porcentajeCent(rapBase, tasa(parametros, 'RAP_TRAB'));
  const isr = calcularIsr(ingresos, parametros);
  if (ihssTrabajador) lineas.push(linea('IHSS_EM_TRAB', 'DEDUCCION', baseIhss, 1, ihssTrabajador, 'min(ingresoGravable, techoIhss) * (EM + IVM)', parametros));
  if (rapTrabajador) lineas.push(linea('RAP_TRAB', 'DEDUCCION', rapBase, 1, rapTrabajador, 'max(0, ingreso - pisoRap) * tasaRap', parametros));
  if (isr) lineas.push(linea('ISR', 'DEDUCCION', ingresos, 1, isr, 'impuestoAnual(ingreso * 12) / 12', parametros));

  const ihssPatronal = contrato.aplicaIhss === false ? 0 : porcentajeCent(baseIhss, tasa(parametros, 'IHSS_EM_PATR') + tasa(parametros, 'IHSS_IVM_PATR'));
  const rapPatronal = contrato.aplicaRap === false ? 0 : porcentajeCent(rapBase, tasa(parametros, 'RAP_PATR'));
  if (ihssPatronal) lineas.push(linea('IHSS_EM_PATR', 'APORTE_PATRONAL', baseIhss, 1, ihssPatronal, 'min(ingresoGravable, techoIhss) * (EM + IVM) patronal', parametros));
  if (rapPatronal) lineas.push(linea('RAP_PATR', 'APORTE_PATRONAL', rapBase, 1, rapPatronal, 'max(0, ingreso - pisoRap) * tasaRap patronal', parametros));

  const totalIngresosCent = lineas.filter((item) => item.tipo === 'INGRESO').reduce((total, item) => total + item.montoCent, 0);
  const totalDeduccionesCent = lineas.filter((item) => item.tipo === 'DEDUCCION').reduce((total, item) => total + item.montoCent, 0);
  const totalAportesPatronalesCent = lineas.filter((item) => item.tipo === 'APORTE_PATRONAL').reduce((total, item) => total + item.montoCent, 0);
  const netoPagarCent = totalIngresosCent - totalDeduccionesCent;
  if (netoPagarCent < 0 || netoPagarCent !== totalIngresosCent - totalDeduccionesCent) {
    throw new Error('CUADRE_PLANILLA_INVALIDO');
  }
  return {
    lineas,
    diasTrabajados: numero(entrada.asistencia?.diasTrabajados),
    horasExtra: extrasDiurnas + extrasNocturnas,
    totalIngresosCent,
    totalDeduccionesCent,
    totalAportesPatronalesCent,
    netoPagarCent,
  };
}

module.exports = { calcularBaseOrdinaria, calcularDetalle, calcularIsr, porcentajeCent, redondearCentavos };
