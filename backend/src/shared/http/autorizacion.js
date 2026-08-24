const { ErrorAplicacion } = require('../dominio/errores');

/**
 * Guarda declarativa de permisos (plan, seccion 11.2).
 * Requiere que el middleware cargarPermisos haya poblado req.contexto.
 */
const exigirPermiso = (codigo) => (req, _res, next) => {
  if (!req.contexto?.permisos?.has(codigo)) {
    return next(
      new ErrorAplicacion(
        'PERMISO_DENEGADO',
        403,
        `Se requiere el permiso ${codigo}.`
      )
    );
  }
  next();
};

module.exports = { exigirPermiso };
