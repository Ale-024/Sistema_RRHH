const { z } = require('zod');

const idNumerico = z.object({
  id: z.coerce.number().int().positive(),
});

module.exports = { idNumerico };
