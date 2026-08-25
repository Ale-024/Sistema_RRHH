const { consolidarDia } = require('../modules/asistencia/application/consolidar-dia.usecase');
const { fechaDiaHonduras } = require('../../shared/dominio/tiempo');

/**
 * Consolidado del dia anterior (en calendario HONDURENO). Idempotente:
 * puede reejecutarse sin alterar resultados; los dias cerrados nunca se
 * recalculan.
 */
async function consolidarAyer(ctx, fecha = null) {
  const objetivo = fecha ?? (() => {
    const ayer = fechaDiaHonduras();
    ayer.setUTCDate(ayer.getUTCDate() - 1);
    return ayer;
  })();
  return consolidarDia(objetivo, ctx);
}

module.exports = { consolidarAyer };
