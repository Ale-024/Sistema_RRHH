const { z } = require('zod');

const fecha = z.coerce.date();

const camposSolicitud = z.object({
  tipoPermisoId: z.coerce.number().int().positive(),
  fechaInicio: fecha,
  fechaFin: fecha,
  horaInicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  horaFin: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  motivo: z.string().trim().min(1).max(1000),
  soporteRuta: z.string().trim().max(500).optional(),
});

const crearSolicitud = camposSolicitud
  .refine((d) => d.fechaFin >= d.fechaInicio, {
    message: 'La fecha final no puede ser anterior a la inicial.',
    path: ['fechaFin'],
  });

const actualizarSolicitud = camposSolicitud.partial().refine(
  (d) => !d.fechaInicio || !d.fechaFin || d.fechaFin >= d.fechaInicio,
  { message: 'La fecha final no puede ser anterior a la inicial.', path: ['fechaFin'] }
);

const cambiarEstado = z.object({
  estado: z.enum(['APROBADO', 'RECHAZADO']),
});

const motivoOpcional = z.object({ motivo: z.string().trim().max(1000).optional() });
const motivoRequerido = z.object({ motivo: z.string().trim().min(1).max(1000) });

const idNumerico = z.object({ id: z.coerce.number().int().positive() });
const consulta = z.object({
  estado: z.enum(['SOLICITADO', 'EN_REVISION', 'APROBADO', 'RECHAZADO', 'CANCELADO']).optional(),
});

module.exports = {
  actualizarSolicitud,
  cambiarEstado,
  consulta,
  crearSolicitud,
  idNumerico,
  motivoOpcional,
  motivoRequerido,
};
