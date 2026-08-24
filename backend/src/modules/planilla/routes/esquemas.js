const { z } = require('zod');

const idNumerico = z.object({ id: z.coerce.number().int().positive() });
const fecha = z.coerce.date();
const crearPeriodo = z.object({
  codigo: z.string().trim().min(3).max(80).regex(/^[A-Za-z0-9._-]+$/),
  tipo: z.enum(['ORDINARIA', 'DECIMO_TERCERO', 'DECIMO_CUARTO', 'AJUSTE', 'LIQUIDACION']).default('ORDINARIA'),
  periodicidad: z.enum(['MENSUAL', 'QUINCENAL', 'SEMANAL', 'LEGACY']).default('MENSUAL'),
  fechaInicio: fecha,
  fechaFin: fecha,
  fechaPago: fecha,
  periodoAjusteDeId: z.coerce.number().int().positive().optional(),
}).refine((datos) => datos.fechaFin >= datos.fechaInicio, { message: 'El periodo es invalido.', path: ['fechaFin'] });

const crearAjuste = z.object({
  codigo: z.string().trim().min(3).max(80).regex(/^[A-Za-z0-9._-]+$/).optional(),
  fechaInicio: fecha.optional(),
  fechaFin: fecha.optional(),
  fechaPago: fecha.optional(),
});

const motivoRequerido = z.object({ motivo: z.string().trim().min(1).max(1000) });
const motivoOpcional = z.object({ motivo: z.string().trim().max(1000).optional() });
const consulta = z.object({ estado: z.enum(['BORRADOR', 'CALCULADA', 'EN_APROBACION', 'CERRADA', 'PAGADA']).optional() });
const crearParametro = z.object({
  clave: z.string().trim().min(2).max(120),
  valor: z.string().trim().min(1).max(200),
  unidad: z.string().trim().max(40).optional(),
  descripcion: z.string().trim().max(500).optional(),
  baseLegal: z.string().trim().max(500).optional(),
  vigenciaDesde: fecha,
  vigenciaHasta: fecha.optional(),
}).refine((datos) => !datos.vigenciaHasta || datos.vigenciaHasta >= datos.vigenciaDesde, { message: 'La vigencia es invalida.', path: ['vigenciaHasta'] });

module.exports = { consulta, crearAjuste, crearParametro, crearPeriodo, idNumerico, motivoOpcional, motivoRequerido };
