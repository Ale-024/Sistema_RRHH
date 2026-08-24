const { z } = require('zod');

const iniciarSesion = z.object({
  email: z.string().trim().min(1).email('Debe ser un correo valido'),
  password: z.string().min(1, 'La contrasena es obligatoria'),
});

const cambiarPassword = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(4),
});

module.exports = { iniciarSesion, cambiarPassword };
