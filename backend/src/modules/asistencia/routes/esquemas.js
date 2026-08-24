const { z } = require('zod');

const consultaAsistencia = z
  .object({
    desde: z.coerce.date().optional(),
    hasta: z.coerce.date().optional(),
  })
  .refine((d) => !d.desde || !d.hasta || d.desde <= d.hasta, {
    message: 'El rango de fechas es invalido.',
  });

module.exports = { consultaAsistencia };
