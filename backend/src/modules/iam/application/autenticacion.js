const jwt = require('jsonwebtoken');
const { ErrorAplicacion } = require('../../../shared/dominio/errores');

/**
 * Middlewares de autenticacion del modulo iam.
 * Otros modulos los consumen a traves de la fachada (iam.module.js).
 */
function verificarToken(req, _res, next) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return next(
      new ErrorAplicacion('TOKEN_AUSENTE', 401, 'Acceso denegado. No hay token.')
    );
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    next(new ErrorAplicacion('TOKEN_INVALIDO', 403, 'Token invalido o expirado.'));
  }
}

function esRol(rolRequerido) {
  return (req, _res, next) => {
    if (req.user?.rol === rolRequerido) {
      return next();
    }
    next(
      new ErrorAplicacion(
        'PERMISO_DENEGADO',
        403,
        `Se requiere el rol ${rolRequerido} para esta accion.`
      )
    );
  };
}

module.exports = { verificarToken, esRol };
