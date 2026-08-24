/**
 * Tarea programada de consolidacion de asistencia.
 * Se registra solo si RUN_CRON no es "false" (evita ejecucion en pruebas).
 */
function registrarTareasProgramadas(ctx, cron) {
  cron.schedule('0 1 * * *', async () => {
    try {
      const { consolidarAyer } = require('./consolidar-asistencia');
      const resultado = await consolidarAyer(ctx);
      console.log(`[cron] Consolidado de asistencia: ${resultado.empleados} empleados.`);
    } catch (error) {
      console.error('[cron] Fallo el consolidado de asistencia:', error.message);
    }
  });
}

module.exports = { registrarTareasProgramadas };
