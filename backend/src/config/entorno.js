const { z } = require('zod');

const esquemaEntorno = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET debe tener al menos 32 caracteres (rotar la clave antigua)'),
  CLAVE_CIFRADO: z
    .string()
    .min(1, 'CLAVE_CIFRADO es obligatoria (base64 de 32 bytes)'),
  ALMACEN_RUTA: z.string().default('./storage'),
  PORT: z.coerce.number().int().positive().default(3000),
  ORIGENES_PERMITIDOS: z.string().default('http://localhost:5173'),
});

function cargarEntorno(source = process.env) {
  const resultado = esquemaEntorno.safeParse(source);
  if (!resultado.success) {
    const detalle = resultado.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Configuracion de entorno invalida -> ${detalle}`);
  }
  return {
    ...resultado.data,
    origenesPermitidos: resultado.data.ORIGENES_PERMITIDOS.split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  };
}

module.exports = { cargarEntorno, esquemaEntorno };
