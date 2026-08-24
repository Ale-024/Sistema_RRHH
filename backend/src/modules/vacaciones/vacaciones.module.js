const { rutasAdmin, rutasEmpleado } = require('./routes/vacaciones.routes');

function registrarSuscriptores(bus, prisma) {
  const responsables = async (evento) => {
    const empleados = await prisma.empleado.findMany({
      where: { usuario: { roles: { some: { rol: { permisos: { some: { permiso: { codigo: 'vacaciones:leer_global' } } } } } } } },
      select: { id: true },
    });
    if (empleados.length) {
      await prisma.notificacion.createMany({ data: empleados.map(({ id }) => ({ empleado_id: id, mensaje: `Nueva solicitud de vacaciones ${evento.folio} pendiente de revision.` })) });
    }
  };
  bus.suscribir('VacacionSolicitada', responsables);
  const notificarEmpleado = async (evento, mensaje) => prisma.notificacion.create({ data: { empleado_id: evento.empleadoId, mensaje } });
  bus.suscribir('VacacionAprobada', (evento) => notificarEmpleado(evento, `Tu solicitud de vacaciones ${evento.folio} fue aprobada.`));
  bus.suscribir('VacacionRechazada', (evento) => notificarEmpleado(evento, `Tu solicitud de vacaciones ${evento.folio} fue rechazada.`));
  bus.suscribir('VacacionCorreccionSolicitada', (evento) => notificarEmpleado(evento, `Tu solicitud de vacaciones ${evento.folio} requiere correccion.`));
}

module.exports = { registrarSuscriptores, rutasEmpleado, rutasAdmin };
