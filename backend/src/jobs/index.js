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
  cron.schedule('0 2 * * *', async () => {
    try {
      const { devengarHoy } = require('./devengar-vacaciones');
      const resultado = await devengarHoy(ctx);
      console.log(`[cron] Devengo vacacional: ${resultado.periodosCreados} periodos.`);
    } catch (error) {
      console.error('[cron] Fallo el devengo vacacional:', error.message);
    }
  });
  cron.schedule('0 9 * * 1', async () => {
    try {
      const { alertarVacacionesPorPrescribir } = require('./prescripcion-vacaciones');
      const resultado = await alertarVacacionesPorPrescribir(ctx);
      console.log(`[cron] Alertas de prescripcion: ${resultado.notificaciones} notificaciones.`);
    } catch (error) {
      console.error('[cron] Fallo la alerta de prescripcion:', error.message);
    }
  });
}

module.exports = { registrarTareasProgramadas };
