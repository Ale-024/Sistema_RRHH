const bcrypt = require('bcryptjs');
const { ErrorAplicacion } = require('../../../shared/dominio/errores');

const COSTE_BCRYPT = 12;

async function cambiarPassword(usuarioId, currentPassword, newPassword, ctx) {
  const { prisma, bus } = ctx;
  const user = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  if (!user) {
    throw new ErrorAplicacion('NO_ENCONTRADO', 404, 'Usuario no encontrado.');
  }

  const valida = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valida) {
    throw new ErrorAplicacion(
      'PASSWORD_ACTUAL_INVALIDA',
      400,
      'La contrasena actual es incorrecta.'
    );
  }

  const nuevoHash = await bcrypt.hash(newPassword, COSTE_BCRYPT);
  await prisma.usuario.update({
    where: { id: usuarioId },
    data: { password_hash: nuevoHash, debeCambiarPassword: false },
  });

  bus.publicar('PasswordCambiada', { usuarioId });
  return { message: 'Contrasena actualizada exitosamente' };
}

module.exports = { cambiarPassword, COSTE_BCRYPT };
