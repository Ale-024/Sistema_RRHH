const { z } = require('zod');

const actualizarPerfil = z
  .object({
    telefono: z.string().trim().max(30).optional(),
    direccion: z.string().trim().max(255).optional(),
    contacto_emergencia: z.string().trim().max(120).optional(),
    telefono_emergencia: z.string().trim().max(30).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar.',
  });

const cambiarPassword = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(4, 'La nueva contrasena debe tener al menos 4 caracteres'),
});

const crearEmpleado = z.object({
  email: z.string().trim().email('Correo invalido'),
  password: z.string().min(4),
  nombres: z.string().trim().min(1).max(60),
  apellidos: z.string().trim().min(1).max(60),
  dni: z.string().trim().min(1).max(20),
  fecha_ingreso: z.coerce.date(),
  telefono: z.string().trim().max(30).optional(),
  direccion: z.string().trim().max(255).optional(),
  puesto_id: z.coerce.number().int().positive(),
  salario: z.coerce.number().nonnegative().optional(),
});

const actualizarEmpleado = z
  .object({
    nombres: z.string().trim().min(1).optional(),
    apellidos: z.string().trim().min(1).optional(),
    telefono: z.string().trim().max(30).optional(),
    puesto_id: z.coerce.number().int().positive().optional(),
    activo: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar.',
  });

const idNumerico = z.object({
  id: z.coerce.number().int().positive(),
});

module.exports = {
  actualizarPerfil,
  cambiarPassword,
  crearEmpleado,
  actualizarEmpleado,
  idNumerico,
};
