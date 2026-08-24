const fs = require('node:fs');
const path = require('node:path');

function crearMetricas() {
  return {
    iniciadoEn: new Date(),
    solicitudes: 0,
    errores: 0,
    porRuta: new Map(),
    porEstado: new Map(),
    tareas: new Map(),
  };
}

function incrementarMapa(mapa, clave, cantidad = 1) {
  mapa.set(clave, (mapa.get(clave) ?? 0) + cantidad);
}

function registrarSolicitud(metrics, req, res) {
  if (!metrics) return;
  metrics.solicitudes += 1;
  incrementarMapa(metrics.porRuta, req.route?.path ?? req.path ?? req.originalUrl);
  incrementarMapa(metrics.porEstado, String(res.statusCode));
}

function registrarTarea(metrics, nombre, duracionMs, error = null) {
  if (!metrics) return;
  metrics.tareas.set(nombre, { duracionMs, ok: !error, error: error?.message ?? null, ocurridoEn: new Date().toISOString() });
}

function snapshotMetricas(metrics) {
  return {
    iniciadoEn: metrics.iniciadoEn.toISOString(),
    activoSegundos: Math.floor((Date.now() - metrics.iniciadoEn.getTime()) / 1000),
    solicitudes: metrics.solicitudes,
    errores: metrics.errores,
    solicitudesPorRuta: Object.fromEntries(metrics.porRuta),
    respuestasPorEstado: Object.fromEntries(metrics.porEstado),
    tareasProgramadas: Object.fromEntries(metrics.tareas),
  };
}

function logJson(nivel, evento, datos = {}) {
  const entrada = { timestamp: new Date().toISOString(), nivel, evento, ...datos };
  const linea = JSON.stringify(entrada);
  (nivel === 'error' ? console.error : console.log)(linea);
  if (process.env.LOG_RUTA) {
    try {
      fs.mkdirSync(path.dirname(process.env.LOG_RUTA), { recursive: true });
      fs.appendFileSync(process.env.LOG_RUTA, `${linea}\n`);
    } catch (error) {
      console.error(JSON.stringify({ timestamp: new Date().toISOString(), nivel: 'error', evento: 'fallo_escritura_log', detalle: error.message }));
    }
  }
}

module.exports = { crearMetricas, registrarSolicitud, registrarTarea, snapshotMetricas, logJson };
