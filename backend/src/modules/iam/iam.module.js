/**
 * Fachada del modulo iam.
 * Unico punto de contacto para el resto de la aplicacion:
 * rutas de autenticacion y middlewares de token/rol.
 */
const { rutasAuth } = require('./routes/auth.routes');
const { verificarToken, esRol } = require('./application/autenticacion');

module.exports = {
  rutasAuth,
  verificarToken,
  esRolAdmin: esRol('ADMIN'),
};
