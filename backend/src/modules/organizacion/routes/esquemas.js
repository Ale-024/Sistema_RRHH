const { z } = require('zod');

const crearDepartamento = z.object({
  nombre: z.string().trim().min(1).max(120),
  descripcion: z.string().trim().max(255).optional(),
});

const crearPuesto = z.object({
  titulo: z.string().trim().min(1).max(120),
  departamento_id: z.coerce.number().int().positive(),
});

const idNumerico = z.object({
  id: z.coerce.number().int().positive(),
});

module.exports = { crearDepartamento, crearPuesto, idNumerico };
