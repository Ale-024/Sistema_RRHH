/**
 * Fachada del modulo iam. Unico punto de contacto para el resto
 * de la aplicacion: rutas de autenticacion y de usuarios, middlewares
 * de token, carga de permisos y rol administrativo legado.
 */
const { rutasAuth } = require('./routes/auth.routes');
const { rutasAdminUsuarios } = require('./routes/usuarios.routes');
const { verificarToken, cargarPermisos, exigirMfaCompletado } = require('./application/autenticacion');
const { cambiarPassword } = require('./application/cambiar-password.usecase');

module.exports = {
  rutasAuth,
  rutasAdminUsuarios,
  verificarToken,
  cargarPermisos,
  exigirMfaCompletado,
  cambiarPassword,
};
