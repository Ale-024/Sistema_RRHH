const express = require('express');

/**
 * Andamiaje del modulo auditoria. Bitacora append-only con triggers:
 * Fase 2.
 */
function rutasAuditoria(_ctx) {
  return express.Router();
}

module.exports = { rutasAuditoria };
