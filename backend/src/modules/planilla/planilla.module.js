/**
 * Fachada del modulo planilla.
 */
const { rutasEmpleado, rutasAdmin } = require('./routes/planilla.routes');

function registrarSuscriptores(bus, prisma) {
  const auditar = (evento, accion) => async (datos) => {
    await prisma.auditoria.create({
      data: {
        usuarioId: datos.usuarioId ?? null,
        entidad: 'PeriodoPlanilla',
        entidadId: datos.periodoId,
        accion,
        despues: JSON.stringify(datos),
      },
    });
  };
  bus.suscribir('PeriodoPlanillaCreado', auditar('PeriodoPlanillaCreado', 'CREAR'));
  bus.suscribir('PlanillaCalculada', auditar('PlanillaCalculada', 'CALCULAR'));
  bus.suscribir('PlanillaEnviadaRevision', auditar('PlanillaEnviadaRevision', 'ENVIAR_REVISION'));
  bus.suscribir('PlanillaDevuelta', auditar('PlanillaDevuelta', 'DEVOLVER'));
  bus.suscribir('PlanillaCerrada', auditar('PlanillaCerrada', 'CERRAR'));
  bus.suscribir('PlanillaPagada', auditar('PlanillaPagada', 'REGISTRAR_PAGO'));
}

module.exports = { registrarSuscriptores, rutasEmpleado, rutasAdmin };
