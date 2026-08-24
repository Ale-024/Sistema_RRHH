async function alertarVacacionesPorPrescribir(ctx, fecha = new Date()) {
  const inicio = new Date(fecha);
  inicio.setHours(0, 0, 0, 0);
  const limite = new Date(inicio);
  limite.setDate(limite.getDate() + 30);
  const periodos = await ctx.prisma.periodoVacacional.findMany({
    where: { estado: 'VIGENTE', hasta: { gte: inicio, lte: limite } },
    include: { empleado: { select: { nombres: true, apellidos: true } } },
  });
  const responsables = await ctx.prisma.empleado.findMany({
    where: { usuario: { roles: { some: { rol: { permisos: { some: { permiso: { codigo: 'vacaciones:leer_global' } } } } } } } },
    select: { id: true },
  });
  if (!periodos.length || !responsables.length) return { periodos: periodos.length, notificaciones: 0 };
  const data = [];
  for (const periodo of periodos) {
    const mensaje = `El periodo vacacional de ${periodo.empleado.nombres} ${periodo.empleado.apellidos} vence el ${new Date(periodo.hasta).toISOString().slice(0, 10)}.`;
    for (const responsable of responsables) data.push({ empleado_id: responsable.id, mensaje });
  }
  await ctx.prisma.notificacion.createMany({ data });
  return { periodos: periodos.length, notificaciones: data.length };
}

module.exports = { alertarVacacionesPorPrescribir };
