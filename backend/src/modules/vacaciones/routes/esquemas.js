const { z } = require('zod');

const fechas = z.object({
  fechaInicio: z.coerce.date(),
  fechaFin: z.coerce.date(),
}).refine((datos) => datos.fechaFin >= datos.fechaInicio, {
  message: 'La fecha final no puede ser anterior a la inicial.',
  path: ['fechaFin'],
});

const crearSolicitud = fechas.extend({
  periodoId: z.coerce.number().int().positive(),
  suplenteId: z.coerce.number().int().positive().optional(),
});

const idNumerico = z.object({ id: z.coerce.number().int().positive() });
const motivoOpcional = z.object({ motivo: z.string().trim().max(1000).optional() });
const motivoRequerido = z.object({ motivo: z.string().trim().min(1).max(1000) });
const consulta = z.object({
  estado: z.enum(['SOLICITADO', 'EN_REVISION', 'APROBADO', 'RECHAZADO', 'CANCELADO']).optional(),
});

module.exports = { consulta, crearSolicitud, idNumerico, motivoOpcional, motivoRequerido };
