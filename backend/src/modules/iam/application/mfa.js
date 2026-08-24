const crypto = require('node:crypto');

const ROLES_MFA = new Set(['RRHH_SUP', 'DIRECCION', 'ADMIN_TI']);
const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer) {
  let bits = 0;
  let valor = 0;
  let salida = '';
  for (const byte of buffer) {
    valor = (valor << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      salida += ALFABETO[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits) salida += ALFABETO[(valor << (5 - bits)) & 31];
  return salida;
}

function base32Decode(texto) {
  let bits = 0;
  let valor = 0;
  const bytes = [];
  for (const caracter of texto.replace(/=+$/, '').toUpperCase()) {
    const indice = ALFABETO.indexOf(caracter);
    if (indice < 0) throw new Error('Secreto TOTP invalido.');
    valor = (valor << 5) | indice;
    bits += 5;
    if (bits >= 8) { bytes.push((valor >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(bytes);
}

function crearSecretoTotp() { return base32Encode(crypto.randomBytes(20)); }

function codigoTotp(secreto, ahora = Date.now()) {
  const contador = Math.floor(ahora / 1000 / 30);
  const mensaje = Buffer.alloc(8);
  mensaje.writeBigUInt64BE(BigInt(contador));
  const hmac = crypto.createHmac('sha1', base32Decode(secreto)).update(mensaje).digest();
  const inicio = hmac[hmac.length - 1] & 15;
  const entero = (hmac.readUInt32BE(inicio) & 0x7fffffff) % 1000000;
  return String(entero).padStart(6, '0');
}

function verificarCodigoTotp(secreto, codigo, ahora = Date.now()) {
  if (!/^\d{6}$/.test(String(codigo))) return false;
  for (const desfase of [-30000, 0, 30000]) {
    const esperado = codigoTotp(secreto, ahora + desfase);
    if (crypto.timingSafeEqual(Buffer.from(esperado), Buffer.from(String(codigo)))) return true;
  }
  return false;
}

function usuarioRequiereMfa(usuario) {
  return (usuario.roles ?? []).some((usuarioRol) => ROLES_MFA.has(usuarioRol.rol?.codigo ?? usuarioRol));
}

function uriTotp(secreto, email) {
  return `otpauth://totp/SIRH-MKT:${encodeURIComponent(email)}?secret=${secreto}&issuer=SIRH-MKT&algorithm=SHA1&digits=6&period=30`;
}

module.exports = { ROLES_MFA, crearSecretoTotp, codigoTotp, verificarCodigoTotp, usuarioRequiereMfa, uriTotp };
