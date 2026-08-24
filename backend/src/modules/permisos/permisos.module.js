/**
 * Fachada del modulo permisos.
 */
const { rutasEmpleado, rutasAdmin } = require('./routes/permisos.routes');

function registrarSuscriptores(bus, prisma) {
  bus.suscribir('PermisoSolicitado', async (evento) => {
    const responsables = await prisma.empleado.findMany({
      where: {
        usuario: {
          roles: {
            some: {
              rol: {
                permisos: { some: { permiso: { codigo: 'solicitudes:leer_global' } } },
              },
            },
          },
        },
      },
      select: { id: true },
    });
    await prisma.notificacion.createMany({
      data: responsables.map(({ id }) => ({
        empleado_id: id,
        mensaje: `Nueva solicitud de permiso ${evento.folio} pendiente de revision.`,
      })),
    });
  });

  const notificarEmpleado = async (evento, mensaje) => {
    await prisma.notificacion.create({
      data: { empleado_id: evento.empleadoId, mensaje },
    });
  };
  bus.suscribir('PermisoAprobado', (evento) =>
    notificarEmpleado(evento, `Tu solicitud de permiso ${evento.folio} fue aprobada.`)
  );
  bus.suscribir('PermisoRechazado', (evento) =>
    notificarEmpleado(evento, `Tu solicitud de permiso ${evento.folio} fue rechazada.`)
  );
  bus.suscribir('PermisoCorreccionSolicitada', (evento) =>
    notificarEmpleado(evento, `Tu solicitud de permiso ${evento.folio} requiere correccion.`)
  );
}

module.exports = { registrarSuscriptores, rutasEmpleado, rutasAdmin };
