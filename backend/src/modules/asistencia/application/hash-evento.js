const crypto = require('node:crypto');

function hashEvento(empleadoId, ocurridoEn, tipo) {
  const iso = new Date(ocurridoEn).toISOString();
  return crypto.createHash('sha256').update(`${empleadoId}|${iso}|${tipo}`).digest('hex');
}

module.exports = { hashEvento };
