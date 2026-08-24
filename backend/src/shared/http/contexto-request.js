const crypto = require('node:crypto');

function contextoRequest(req, res, next) {
  req.contexto = {
    requestId: crypto.randomUUID(),
    ip: req.ip,
    inicio: Date.now(),
  };
  res.setHeader('X-Request-Id', req.contexto.requestId);
  next();
}

module.exports = contextoRequest;
