const crypto = require('node:crypto');

/**
 * Cifrado en reposo de campos sensibles (plan, seccion 11.4).
 * AES-256-GCM para confidencialidad y HMAC deterministico para
 * busqueda exacta sin descifrar.
 */
function crearCifrador(claveBase64) {
  const clave = Buffer.from(claveBase64, 'base64');
  if (clave.length !== 32) {
    throw new Error(
      'CLAVE_CIFRADO invalida: debe ser base64 de exactamente 32 bytes.'
    );
  }

  const claveHmac = crypto
    .createHash('sha256')
    .update(Buffer.concat([clave, Buffer.from('hmac-busqueda')]))
    .digest();

  return {
    cifrar(texto) {
      if (texto === null || texto === undefined || texto === '') return null;
      const iv = crypto.randomBytes(12);
      const cifrador = crypto.createCipheriv('aes-256-gcm', clave, iv);
      const datos = Buffer.concat([
        cifrador.update(String(texto), 'utf8'),
        cifrador.final(),
      ]);
      const tag = cifrador.getAuthTag();
      return Buffer.concat([iv, tag, datos]).toString('base64');
    },

    descifrar(payload) {
      if (!payload) return null;
      const bruto = Buffer.from(payload, 'base64');
      const iv = bruto.subarray(0, 12);
      const tag = bruto.subarray(12, 28);
      const datos = bruto.subarray(28);
      const descifrador = crypto.createDecipheriv('aes-256-gcm', clave, iv);
      descifrador.setAuthTag(tag);
      return Buffer.concat([
        descifrador.update(datos),
        descifrador.final(),
      ]).toString('utf8');
    },

    hmac(texto) {
      if (texto === null || texto === undefined || texto === '') return null;
      return crypto
        .createHmac('sha256', claveHmac)
        .update(String(texto).trim().toLowerCase())
        .digest('hex');
    },
  };
}

module.exports = { crearCifrador };
