const { z } = require('zod');

const crearSolicitud = z
  .object({
    tipo: z.enum(['VACACIONES', 'PERMISO']),
    fecha_inicio: z.coerce.date(),
    fecha_fin: z.coerce.date(),
    motivo: z.string().trim().min(1).max(500),
  })
  .refine((d) => d.fecha_fin >= d.fecha_inicio, {
    message: 'La fecha final no puede ser anterior a la inicial.',
    path: ['fecha_fin'],
  });

const cambiarEstado = z.object({
  estado: z.enum(['APROBADA', 'RECHAZADA']),
});

const idNumerico = z.object({
  id: z.coerce.number().int().positive(),
});

module.exports = { crearSolicitud, cambiarEstado, idNumerico };
