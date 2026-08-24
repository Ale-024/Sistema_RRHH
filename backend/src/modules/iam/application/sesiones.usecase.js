const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const { ErrorAplicacion } = require('../../../shared/dominio/errores');
const { sha256 } = require('./iniciar-sesion.usecase');

const DIAS_REFRESH = 7;

/**
 * Rotacion de refresh token con deteccion de reuso (plan, seccion 11.1):
 * si se presenta un token ya rotado o revocado, se revoca la familia completa.
 */
async function refrescarSesion(refreshToken, ctx) {
  const { prisma, req } = ctx;
  if (!refreshToken) {
    throw new ErrorAplicacion('REFRESH_AUSENTE', 401, 'No hay sesion que renovar.');
  }

  const sesion = await prisma.sesionRefresh.findUnique({
    where: { tokenHash: sha256(refreshToken) },
  });

  if (!sesion) {
    throw new ErrorAplicacion('REFRESH_INVALIDO', 401, 'Sesion no valida.');
  }

  if (sesion.revocadoEn) {
    // Reuso detectado: revocar toda la familia y auditar.
    await prisma.sesionRefresh.updateMany({
      where: { familiaId: sesion.familiaId, revocadoEn: null },
      data: { revocadoEn: new Date(), motivoRevoca: 'REUSO_DETECTADO' },
    });
    await prisma.auditoria.create({
      data: {
        usuarioId: sesion.usuarioId,
        entidad: 'SesionRefresh',
        entidadId: null,
        accion: 'REUSO_REFRESH',
        despues: JSON.stringify({ familiaId: sesion.familiaId }),
        ip: req?.ip,
        userAgent: req?.headers?.['user-agent'],
        requestId: req?.contexto?.requestId,
      },
    });
    throw new ErrorAplicacion(
      'REUSO_REFRESH',
      401,
      'Sesion comprometida. Todos los accesos fueron revocados.'
    );
  }

  if (sesion.expiraEn < new Date()) {
    await prisma.sesionRefresh.update({
      where: { id: sesion.id },
      data: { revocadoEn: new Date(), motivoRevoca: 'EXPIRADO' },
    });
    throw new ErrorAplicacion('REFRESH_EXPIRADO', 401, 'La sesion expiro.');
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: sesion.usuarioId },
    include: { roles: { include: { rol: true } }, empleado: true },
  });
  if (!usuario || usuario.estado !== 'ACTIVO') {
    throw new ErrorAplicacion('CUENTA_DESATIVADA', 403, 'La cuenta no esta activa.');
  }

  const nuevoRefresh = crypto.randomBytes(32).toString('hex');
  const accessToken = jwt.sign(
    {
      id: usuario.id,
      empleado_id: usuario.empleado?.id,
      roles: usuario.roles.map((r) => r.rol.codigo),
    },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  await prisma.$transaction([
    prisma.sesionRefresh.update({
      where: { id: sesion.id },
      data: { revocadoEn: new Date(), motivoRevoca: 'ROTACION' },
    }),
    prisma.sesionRefresh.create({
      data: {
        usuarioId: usuario.id,
        tokenHash: sha256(nuevoRefresh),
        familiaId: sesion.familiaId,
        expiraEn: new Date(Date.now() + DIAS_REFRESH * 24 * 60 * 60 * 1000),
        ip: req?.ip,
        userAgent: req?.headers?.['user-agent'],
      },
    }),
  ]);

  ctx.resCookie?.({
    key: 'sirh_refresh',
    value: nuevoRefresh,
    maxAge: DIAS_REFRESH * 24 * 60 * 60 * 1000,
  });

  return { token: accessToken };
}

/** Revoca la familia de sesiones activas del usuario (logout). */
async function cerrarSesion(usuarioId, refreshToken, ctx) {
  const { prisma } = ctx;
  if (refreshToken) {
    const sesion = await prisma.sesionRefresh.findUnique({
      where: { tokenHash: sha256(refreshToken) },
    });
    if (sesion && !sesion.revocadoEn) {
      await prisma.sesionRefresh.updateMany({
        where: { familiaId: sesion.familiaId, revocadoEn: null },
        data: { revocadoEn: new Date(), motivoRevoca: 'LOGOUT' },
      });
    }
  } else {
    await prisma.sesionRefresh.updateMany({
      where: { usuarioId, revocadoEn: null },
      data: { revocadoEn: new Date(), motivoRevoca: 'LOGOUT' },
    });
  }
  ctx.resCookie?.({ key: 'sirh_refresh', value: '', maxAge: 0 });
  return { message: 'Sesion cerrada.' };
}

module.exports = { refrescarSesion, cerrarSesion };
