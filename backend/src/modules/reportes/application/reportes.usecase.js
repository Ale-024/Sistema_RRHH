const { Prisma } = require('@prisma/client');
const { ErrorAplicacion } = require('../../../shared/dominio/errores');

function rango(query) {
  const ahora = new Date();
  const anio = Number(query.anio ?? ahora.getUTCFullYear());
  const mes = query.mes ? Number(query.mes) : null;
  if (mes) {
    return {
      anio,
      mes,
      desde: new Date(Date.UTC(anio, mes - 1, 1)),
      hasta: new Date(Date.UTC(anio, mes, 0, 23, 59, 59, 999)),
    };
  }
  return { anio, mes: null, desde: new Date(Date.UTC(anio, 0, 1)), hasta: new Date(Date.UTC(anio, 11, 31, 23, 59, 59, 999)) };
}

function filtroDepartamentos(contexto, campo = 'departamentoId') {
  if (contexto?.permisos?.has('reportes:ver_global') || contexto?.permisos?.has('empleados:leer_global')) return {};
  const alcances = contexto?.scopeDepartamentos ?? [];
  return { [campo]: { in: alcances.length ? alcances : [-1] } };
}

function validarRango(query) {
  const resultado = rango(query);
  if (!Number.isInteger(resultado.anio) || resultado.anio < 2000 || resultado.anio > 2200) {
    throw new ErrorAplicacion('DATOS_INVALIDOS', 422, 'El anio del reporte no es valido.');
  }
  if (resultado.mes !== null && (!Number.isInteger(resultado.mes) || resultado.mes < 1 || resultado.mes > 12)) {
    throw new ErrorAplicacion('DATOS_INVALIDOS', 422, 'El mes del reporte no es valido.');
  }
  return resultado;
}

async function asistencia(query, contexto, ctx) {
  const r = validarRango(query);
  return ctx.prisma.proyeccionAsistenciaMensual.findMany({
    where: { anio: r.anio, ...(r.mes ? { mes: r.mes } : {}), ...filtroDepartamentos(contexto) },
    include: { empleado: { select: { id: true, nombres: true, apellidos: true, puesto: { select: { departamento: true } } } } },
    orderBy: [{ mes: 'asc' }, { empleadoId: 'asc' }],
  });
}

async function ausentismo(query, contexto, ctx) {
  const filas = await asistencia(query, contexto, ctx);
  const acumulado = new Map();
  for (const fila of filas) {
    const departamento = fila.departamentoId;
    const actual = acumulado.get(departamento) ?? {
      departamentoId: departamento,
      departamento: fila.empleado.puesto.departamento.nombre,
      empleados: 0,
      diasPresente: 0,
      diasAusente: 0,
      diasTardanza: 0,
      minutosTardanza: 0,
    };
    actual.empleados += 1;
    actual.diasPresente += fila.diasPresente;
    actual.diasAusente += fila.diasAusente;
    actual.diasTardanza += fila.diasTardanza;
    actual.minutosTardanza += fila.minutosTardanza;
    acumulado.set(departamento, actual);
  }
  return [...acumulado.values()].map((fila) => ({
    ...fila,
    pctAusentismo: fila.diasPresente + fila.diasAusente ? Number(((fila.diasAusente / (fila.diasPresente + fila.diasAusente)) * 100).toFixed(2)) : 0,
  }));
}

async function personalPorProyecto(query, contexto, ctx) {
  const hasta = query.hasta ? new Date(query.hasta) : new Date(Date.UTC(Number(query.anio ?? new Date().getUTCFullYear()), 11, 31, 23, 59, 59, 999));
  const desde = query.desde ? new Date(query.desde) : new Date(Date.UTC(Number(query.anio ?? new Date().getUTCFullYear()), 0, 1));
  const global = contexto?.permisos?.has('reportes:ver_global') || contexto?.permisos?.has('empleados:leer_global');
  const asignaciones = await ctx.prisma.asignacionProyecto.findMany({
    where: {
      desde: { lte: hasta },
      OR: [{ hasta: null }, { hasta: { gte: desde } }],
      ...(global ? {} : { empleado: { puesto: { departamento_id: { in: contexto?.scopeDepartamentos?.length ? contexto.scopeDepartamentos : [-1] } } } }),
    },
    include: {
      proyecto: { include: { departamento: true } },
      empleado: { select: { id: true, nombres: true, apellidos: true, puesto: { include: { departamento: true } } } },
    },
    orderBy: [{ proyectoId: 'asc' }, { empleado: { apellidos: 'asc' } }],
  });
  return asignaciones.map((fila) => ({
    proyecto: fila.proyecto.codigo,
    proyectoNombre: fila.proyecto.nombre,
    empleadoId: fila.empleado.id,
    empleado: `${fila.empleado.nombres} ${fila.empleado.apellidos}`,
    departamento: fila.empleado.puesto.departamento.nombre,
    porcentajeDedicacion: fila.porcentajeDedicacion,
    desde: fila.desde,
    hasta: fila.hasta,
  }));
}

async function costoPlanilla(query, contexto, ctx) {
  const r = validarRango(query);
  return ctx.prisma.proyeccionCostoPlanilla.findMany({
    where: { anio: r.anio, ...(r.mes ? { mes: r.mes } : {}), ...filtroDepartamentos(contexto) },
    include: { departamento: true },
    orderBy: [{ mes: 'asc' }, { departamentoId: 'asc' }],
  });
}

async function buscarEmpleados(texto, contexto, ctx) {
  const consulta = texto.trim().replace(/["*:^()]/g, ' ');
  if (consulta.length < 2) throw new ErrorAplicacion('DATOS_INVALIDOS', 422, 'La busqueda requiere al menos 2 caracteres.');
  const filas = await ctx.prisma.$queryRaw(Prisma.sql`SELECT empleadoId FROM empleado_fts WHERE empleado_fts MATCH ${`${consulta}*`} LIMIT 50`);
  const ids = filas.map((fila) => Number(fila.empleadoId));
  if (!ids.length) return [];
  return ctx.prisma.empleado.findMany({
    where: { id: { in: ids }, ...((contexto?.permisos?.has('reportes:ver_global') || contexto?.permisos?.has('empleados:leer_global')) ? {} : { puesto: { departamento_id: { in: contexto?.scopeDepartamentos?.length ? contexto.scopeDepartamentos : [-1] } } }) },
    select: { id: true, nombres: true, apellidos: true, puesto: { select: { titulo: true, departamento: true } } },
  });
}

module.exports = { asistencia, ausentismo, personalPorProyecto, costoPlanilla, buscarEmpleados, validarRango };
