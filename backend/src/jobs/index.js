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
  cron.schedule('30 2 * * *', async () => {
    const inicio = Date.now();
    try {
      const { refrescarProyecciones } = require('../modules/reportes/application/proyecciones.usecase');
      const resultado = await refrescarProyecciones(ctx);
      const duracionMs = Date.now() - inicio;
      registrarTarea(ctx.metrics, 'proyecciones', duracionMs);
      logJson('info', 'proyecciones_refrescadas', { ...resultado, duracionMs });
    } catch (error) {
      const duracionMs = Date.now() - inicio;
      registrarTarea(ctx.metrics, 'proyecciones', duracionMs, error);
      logJson('error', 'fallo_proyecciones', { error: error.message, duracionMs });
    }
  });
  cron.schedule('30 23 * * *', async () => {
    const inicio = Date.now();
    try {
      const { respaldar } = require('../../scripts/respaldar');
      const resultado = respaldar({ databaseUrl: ctx.entorno.DATABASE_URL, directorio: process.env.BACKUP_RUTA });
      const duracionMs = Date.now() - inicio;
      registrarTarea(ctx.metrics, 'respaldo', duracionMs);
      logJson('info', 'respaldo_completado', { ...resultado, duracionMs });
    } catch (error) {
      const duracionMs = Date.now() - inicio;
      registrarTarea(ctx.metrics, 'respaldo', duracionMs, error);
      logJson('error', 'fallo_respaldo', { error: error.message, duracionMs });
    }
  });
  cron.schedule('0 * * * *', async () => {
    const inicio = Date.now();
    try {
      const { revisar, notificarPorCorreo } = require('../../scripts/alertar-operacion');
      const resultado = revisar();
      const notificacion = await notificarPorCorreo(resultado);
      const duracionMs = Date.now() - inicio;
      registrarTarea(ctx.metrics, 'alertas_operativas', duracionMs, resultado.ok ? null : new Error('Se detectaron alertas operativas'));
      logJson(resultado.ok ? 'info' : 'error', 'alerta_operativa', { ...resultado, notificacion, duracionMs });
    } catch (error) {
      const duracionMs = Date.now() - inicio;
      registrarTarea(ctx.metrics, 'alertas_operativas', duracionMs, error);
      logJson('error', 'fallo_alertas_operativas', { error: error.message, duracionMs });
    }
  });
}

module.exports = { registrarTareasProgramadas };
const { registrarTarea, logJson } = require('../shared/infra/observabilidad');
