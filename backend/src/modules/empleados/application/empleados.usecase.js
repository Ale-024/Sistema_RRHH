const bcrypt = require('bcryptjs');
const { ErrorAplicacion } = require('../../../shared/dominio/errores');

/**
 * Casos de uso de empleados. Las lecturas simples acceden a Prisma
 * directamente desde las rutas (CQRS ligero); aqui van los comandos
 * con reglas de negocio.
 */

async function actualizarPerfil(empleadoId, datos, { prisma }) {
  return prisma.empleado.update({ where: { id: empleadoId }, data: datos });
}

async function cambiarPassword(usuarioId, currentPassword, newPassword, { prisma, bus }) {
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

  const nuevoHash = await bcrypt.hash(newPassword, 10);
  await prisma.usuario.update({
    where: { id: usuarioId },
    data: { password_hash: nuevoHash },
  });

  bus.publicar('PasswordCambiada', { usuarioId });
  return { message: 'Contrasena actualizada exitosamente' };
}

async function crearEmpleado(datos, { prisma, bus }) {
  const hashedPassword = await bcrypt.hash(datos.password, 10);

  const newUser = await prisma.usuario.create({
    data: {
      email: datos.email,
      password_hash: hashedPassword,
      rol: 'EMPLOYEE',
      empleado: {
        create: {
          nombres: datos.nombres,
          apellidos: datos.apellidos,
          dni: datos.dni,
          fecha_ingreso: datos.fecha_ingreso,
          telefono: datos.telefono,
          direccion: datos.direccion,
          puesto_id: datos.puesto_id,
        },
      },
    },
    include: { empleado: true },
  });

  // Nota (Fase 2 lo corrige): la contrasena viaja en texto plano dentro
  // de la notificacion; es el comportamiento vigente del MVP.
  await prisma.notificacion.create({
    data: {
      empleado_id: newUser.empleado.id,
      mensaje: `¡Bienvenido/a ${datos.nombres} ${datos.apellidos}! Tu cuenta ha sido creada exitosamente. Tu contrasena temporal es: ${datos.password}. Por favor, cambiala desde tu perfil lo antes posible.`,
    },
  });

  bus.publicar('EmpleadoContratado', { empleadoId: newUser.empleado.id });
  return newUser;
}

async function actualizarEmpleado(id, datos, { prisma }) {
  const { activo, ...datosEmpleado } = datos;
  const empleado = await prisma.empleado.update({
    where: { id },
    data: datosEmpleado,
  });

  if (activo !== undefined) {
    await prisma.usuario.update({
      where: { id: empleado.usuario_id },
      data: { activo },
    });
  }

  return empleado;
}

async function desactivarEmpleado(id, { prisma, bus }) {
  const empleado = await prisma.empleado.findUnique({ where: { id } });
  if (!empleado) {
    throw new ErrorAplicacion('NO_ENCONTRADO', 404, 'Empleado no encontrado.');
  }
  const user = await prisma.usuario.update({
    where: { id: empleado.usuario_id },
    data: { activo: false },
  });
  bus.publicar('EmpleadoDesactivado', { empleadoId: id });
  return { message: 'Empleado desactivado (Baja logica)', data: user };
}

module.exports = {
  actualizarPerfil,
  cambiarPassword,
  crearEmpleado,
  actualizarEmpleado,
  desactivarEmpleado,
};
