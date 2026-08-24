const crypto = require('node:crypto');
const { registrarSolicitud, logJson } = require('../infra/observabilidad');

function contextoRequest(req, res, next) {
  req.contexto = {
    requestId: crypto.randomUUID(),
    ip: req.ip,
    inicio: Date.now(),
  };
  res.setHeader('X-Request-Id', req.contexto.requestId);
  res.on('finish', () => {
    const duracionMs = Date.now() - req.contexto.inicio;
    registrarSolicitud(req.app.locals.metrics, req, res);
    logJson('info', 'http_request', {
      requestId: req.contexto.requestId,
      usuarioId: req.user?.id ?? null,
      ruta: req.originalUrl,
      metodo: req.method,
      latenciaMs: duracionMs,
      estado: res.statusCode,
    });
  });
  next();
}

module.exports = contextoRequest;
