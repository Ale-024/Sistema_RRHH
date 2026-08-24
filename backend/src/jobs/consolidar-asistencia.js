const { consolidarDia } = require('../modules/asistencia/application/consolidar-dia.usecase');

/**
 * Consolidado del dia anterior. Idempotente: puede reejecutarse sin
 * alterar resultados; los dias cerrados nunca se recalculan.
 */
async function consolidarAyer(ctx, fecha = null) {
  const objetivo = fecha ?? (() => {
    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 1);
    return ayer;
  })();
  return consolidarDia(objetivo, ctx);
}

module.exports = { consolidarAyer };
