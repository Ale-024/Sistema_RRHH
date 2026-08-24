const { ErrorAplicacion } = require('../../../shared/dominio/errores');

/**
 * Gestion de usuarios y roles (permiso usuarios:administrar).
 */
async function listarUsuarios(ctx) {
  return ctx.prisma.usuario.findMany({
    select: {
      id: true,
      email: true,
      estado: true,
      ultimoAcceso: true,
      debeCambiarPassword: true,
      empleado: { select: { nombres: true, apellidos: true } },
      roles: {
        select: { rol: { select: { codigo: true, nombre: true } }, scopeDepartamentoId: true },
      },
    },
    orderBy: { id: 'asc' },
  });
}

async function asignarRol(usuarioId, { rolCodigo, scopeDepartamentoId }, ctx) {
  const { prisma } = ctx;
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  if (!usuario) throw new ErrorAplicacion('NO_ENCONTRADO', 404, 'Usuario no encontrado.');

  const rol = await prisma.rol.findUnique({ where: { codigo: rolCodigo } });
  if (!rol) throw new ErrorAplicacion('ROL_INVALIDO', 422, 'El rol indicado no existe.');

  await prisma.usuarioRol.upsert({
    where: { usuarioId_rolId: { usuarioId, rolId: rol.id } },
    update: { scopeDepartamentoId: scopeDepartamentoId ?? null },
    create: {
      usuarioId,
      rolId: rol.id,
      scopeDepartamentoId: scopeDepartamentoId ?? null,
    },
  });

  return { message: `Rol ${rolCodigo} asignado.` };
}

async function quitarRol(usuarioId, rolId, ctx) {
  const { prisma } = ctx;
  const restantes = await prisma.usuarioRol.count({ where: { usuarioId } });
  if (restantes <= 1) {
    throw new ErrorAplicacion(
      'ULTIMO_ROL',
      409,
      'El usuario debe conservar al menos un rol.'
    );
  }
  await prisma.usuarioRol.delete({
    where: { usuarioId_rolId: { usuarioId, rolId } },
  });
  return { message: 'Rol retirado.' };
}

async function cambiarEstado(usuarioId, estado, ctx) {
  const { prisma } = ctx;
  const estadosValidos = ['ACTIVO', 'INACTIVO', 'BLOQUEADO'];
  if (!estadosValidos.includes(estado)) {
    throw new ErrorAplicacion('ESTADO_INVALIDO', 422, 'Estado no permitido.');
  }
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  if (!usuario) throw new ErrorAplicacion('NO_ENCONTRADO', 404, 'Usuario no encontrado.');

  await prisma.usuario.update({
    where: { id: usuarioId },
    data: {
      estado,
      ...(estado === 'INACTIVO'
        ? {
            sesiones: {
              updateMany: { where: { revocadoEn: null }, data: { revocadoEn: new Date(), motivoRevoca: 'CUENTA_DESATIVADA' } },
            },
          }
        : {}),
    },
  });
  return { message: `Estado cambiado a ${estado}.` };
}

async function listarRoles(ctx) {
  return ctx.prisma.rol.findMany({
    include: { permisos: { include: { permiso: true } } },
    orderBy: { id: 'asc' },
  });
}

module.exports = { listarUsuarios, asignarRol, quitarRol, cambiarEstado, listarRoles };
