const jwt = require('jsonwebtoken');
const { ErrorAplicacion } = require('../../../shared/dominio/errores');

/**
 * Middlewares de autenticacion y autorizacion del modulo iam.
 * - verificarToken: valida el access token (15 min).
 * - cargarPermisos: resuelve permisos efectivos y alcance departamental
 *   desde la base de datos en cada peticion (fuente unica de verdad).
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
    // 401 (no 403): permite al frontend distinguir sesion expirada
    // de permiso denegado y disparar el refresh/relogin.
    next(new ErrorAplicacion('TOKEN_INVALIDO', 401, 'Sesion invalida o expirada.'));
  }
}

async function cargarPermisos(req, _res, next) {
  try {
    const usuario = await req.app.locals.prisma.usuario.findUnique({
      where: { id: req.user.id },
      select: {
        estado: true,
        roles: {
          select: {
            scopeDepartamentoId: true,
            rol: { select: { permisos: { select: { permiso: { select: { codigo: true } } } } } },
          },
        },
      },
    });

    if (!usuario || usuario.estado !== 'ACTIVO') {
      throw new ErrorAplicacion(
        'CUENTA_DESATIVADA',
        403,
        'La cuenta no esta activa.'
      );
    }

    const permisos = new Set();
    const alcances = new Set();
    for (const usuarioRol of usuario.roles) {
      if (usuarioRol.scopeDepartamentoId) alcances.add(usuarioRol.scopeDepartamentoId);
      for (const rp of usuarioRol.rol.permisos) permisos.add(rp.permiso.codigo);
    }

    if (!req.contexto) req.contexto = {};
    req.contexto.permisos = permisos;
    req.contexto.scopeDepartamentos = [...alcances];
    next();
  } catch (error) {
    next(error);
  }
}

function exigirMfaCompletado(req, _res, next) {
  if (req.user?.mfa_setup) {
    return next(new ErrorAplicacion('MFA_REQUERIDO', 403, 'Debe completar la configuracion MFA antes de acceder al sistema.'));
  }
  next();
}

module.exports = { verificarToken, cargarPermisos, exigirMfaCompletado };
