const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { ErrorAplicacion } = require('../../../shared/dominio/errores');

/**
 * Caso de uso: iniciar sesion.
 * Conserva el contrato del MVP: token JWT de 8h con { id, rol, empleado_id }.
 * La migracion a refresh rotativo ocurre en la Fase 2.
 */
async function iniciarSesion({ email, password }, { prisma }) {
  const usuario = await prisma.usuario.findUnique({
    where: { email },
    include: { empleado: true },
  });

  if (!usuario) {
    throw new ErrorAplicacion('CREDENCIALES_INVALIDAS', 401, 'Credenciales invalidas.');
  }

  if (!usuario.activo) {
    throw new ErrorAplicacion(
      'CUENTA_DESATIVADA',
      403,
      'Cuenta desactivada. Contacte a RRHH.'
    );
  }

  const passwordValida = await bcrypt.compare(password, usuario.password_hash);
  if (!passwordValida) {
    throw new ErrorAplicacion('CREDENCIALES_INVALIDAS', 401, 'Credenciales invalidas.');
  }

  const token = jwt.sign(
    { id: usuario.id, rol: usuario.rol, empleado_id: usuario.empleado?.id },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  return {
    token,
    user: {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
      nombres: usuario.empleado?.nombres,
      apellidos: usuario.empleado?.apellidos,
    },
  };
}

module.exports = { iniciarSesion };
