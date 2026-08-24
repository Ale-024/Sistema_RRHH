const { z } = require('zod');

const actualizarPerfil = z
  .object({
    telefono: z.string().trim().max(30).optional(),
    direccion: z.string().trim().max(255).optional(),
    contacto_emergencia: z.string().trim().max(120).optional(),
    telefono_emergencia: z.string().trim().max(30).optional(),
    rtn: z.string().trim().max(20).optional(),
    numeroIhss: z.string().trim().max(20).optional(),
    banco: z.string().trim().max(60).optional(),
    cuentaBancaria: z.string().trim().max(40).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar.',
  });

const crearEmpleado = z.object({
  email: z.string().trim().email('Correo invalido'),
  password: z.string().min(8),
  nombres: z.string().trim().min(1).max(60),
  apellidos: z.string().trim().min(1).max(60),
  dni: z.string().trim().min(1).max(20),
  fecha_ingreso: z.coerce.date(),
  telefono: z.string().trim().max(30).optional(),
  direccion: z.string().trim().max(255).optional(),
  puesto_id: z.coerce.number().int().positive(),
  rtn: z.string().trim().max(20).optional(),
  fecha_nacimiento: z.coerce.date().optional(),
  sexo: z.enum(['M', 'F', 'O']).optional(),
  // Contrato inicial (obligatorio en CU01)
  modalidad: z.enum(['PERMANENTE', 'POR_PROYECTO', 'POR_DIA', 'POR_HORA']),
  salario: z.coerce.number().positive('El salario debe ser mayor a cero'),
  periodicidad: z.enum(['MENSUAL', 'QUINCENAL', 'SEMANAL', 'POR_JORNADA']),
  aplica_ihss: z.boolean().default(true),
  aplica_rap: z.boolean().default(true),
});

const actualizarEmpleado = z
  .object({
    nombres: z.string().trim().min(1).optional(),
    apellidos: z.string().trim().min(1).optional(),
    telefono: z.string().trim().max(30).optional(),
    direccion: z.string().trim().max(255).optional(),
    puesto_id: z.coerce.number().int().positive().optional(),
    activo: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar.',
  });

const desvincular = z.object({
  causa: z.enum(['RENUNCIA', 'DESPIDO', 'MUTUO_ACUERDO', 'JUBILACION', 'OTRA']),
  motivo: z.string().trim().min(5).max(500),
  fecha: z.coerce.date().default(() => new Date()),
});

const crearContrato = z.object({
  modalidad: z.enum(['PERMANENTE', 'POR_PROYECTO', 'POR_DIA', 'POR_HORA']),
  salario: z.coerce.number().positive('El salario debe ser mayor a cero'),
  periodicidad: z.enum(['MENSUAL', 'QUINCENAL', 'SEMANAL', 'POR_JORNADA']),
  vigenciaDesde: z.coerce.date().default(() => new Date()),
  aplica_ihss: z.boolean().default(true),
  aplica_rap: z.boolean().default(true),
});

const cambiarPassword = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'La nueva contrasena debe tener al menos 8 caracteres'),
});

const idNumerico = z.object({
  id: z.coerce.number().int().positive(),
});

module.exports = {
  actualizarPerfil,
  cambiarPassword,
  crearEmpleado,
  actualizarEmpleado,
  desvincular,
  crearContrato,
  idNumerico,
};
