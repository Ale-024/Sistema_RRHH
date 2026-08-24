const { z } = require('zod');

const crearNomina = z
  .object({
    empleado_id: z.coerce.number().int().positive(),
    periodo_inicio: z.coerce.date(),
    periodo_fin: z.coerce.date(),
    fecha_pago: z.coerce.date(),
    salario_bruto: z.coerce.number().nonnegative(),
    deducciones: z.coerce.number().nonnegative(),
  })
  .refine((d) => d.periodo_fin >= d.periodo_inicio, {
    message: 'El periodo es invalido.',
    path: ['periodo_fin'],
  })
  .refine((d) => d.deducciones <= d.salario_bruto, {
    message: 'Las deducciones no pueden superar el salario bruto.',
    path: ['deducciones'],
  });

const actualizarNomina = z
  .object({
    salario_bruto: z.coerce.number().nonnegative().optional(),
    deducciones: z.coerce.number().nonnegative().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'Debe enviar al menos un campo.',
  });

const idNumerico = z.object({
  id: z.coerce.number().int().positive(),
});

module.exports = { crearNomina, actualizarNomina, idNumerico };
