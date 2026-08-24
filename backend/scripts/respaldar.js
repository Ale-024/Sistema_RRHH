require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

function fechaArchivo(fecha = new Date()) {
  return fecha.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 13);
}

function rutaBase(url) {
  if (!url?.startsWith('file:')) throw new Error('DATABASE_URL debe apuntar a un archivo SQLite.');
  return url.slice(5).split('?')[0];
}

function integridad(archivo) {
  const db = new DatabaseSync(archivo);
  try { return db.prepare('PRAGMA integrity_check').get().integrity_check === 'ok'; } finally { db.close(); }
}

function claveExternaBase64(valor) {
  const clave = Buffer.from(valor ?? '', 'base64');
  if (clave.length !== 32) throw new Error('BACKUP_EXTERNO_CLAVE debe ser base64 de 32 bytes.');
  return clave;
}

function cifrarCopia(archivo, destino, claveBase64) {
  const clave = claveExternaBase64(claveBase64);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', clave, iv);
  const datos = Buffer.concat([cipher.update(fs.readFileSync(archivo)), cipher.final()]);
  const etiqueta = cipher.getAuthTag();
  fs.writeFileSync(destino, Buffer.concat([Buffer.from('SIRHENC1'), iv, etiqueta, datos]));
  return destino;
}

function descifrarCopia(archivo, claveBase64) {
  const contenido = fs.readFileSync(archivo);
  if (contenido.subarray(0, 8).toString() !== 'SIRHENC1') throw new Error('Formato de respaldo cifrado invalido.');
  const clave = claveExternaBase64(claveBase64);
  const iv = contenido.subarray(8, 20);
  const etiqueta = contenido.subarray(20, 36);
  const decipher = crypto.createDecipheriv('aes-256-gcm', clave, iv);
  decipher.setAuthTag(etiqueta);
  return Buffer.concat([decipher.update(contenido.subarray(36)), decipher.final()]);
}

function rotar(directorio, ahora = new Date()) {
  const archivos = fs.readdirSync(directorio).filter((nombre) => /^sirh-\d{8}-\d{4}\.db$/.test(nombre)).sort().reverse();
  const conservar = new Set(archivos.slice(0, 30));
  const meses = new Set();
  for (const nombre of archivos) {
    const mes = nombre.slice(5, 11);
    if (conservar.has(nombre) || meses.size >= 12 || meses.has(mes)) continue;
    meses.add(mes);
    conservar.add(nombre);
  }
  for (const nombre of archivos) if (!conservar.has(nombre)) fs.rmSync(path.join(directorio, nombre));
  return { existentes: archivos.length, conservados: conservar.size, ejecutadoEn: ahora.toISOString() };
}

function respaldar({ databaseUrl = process.env.DATABASE_URL, directorio = process.env.BACKUP_RUTA ?? path.resolve('backups'), externo = process.env.BACKUP_EXTERNO_RUTA, claveExterna = process.env.BACKUP_EXTERNO_CLAVE, ahora = new Date() } = {}) {
  const origen = rutaBase(databaseUrl);
  if (!fs.existsSync(origen)) throw new Error(`No existe la base de datos: ${origen}`);
  fs.mkdirSync(directorio, { recursive: true });
  const destino = path.resolve(directorio, `sirh-${fechaArchivo(ahora)}.db`);
  const db = new DatabaseSync(origen);
  try {
    const seguro = destino.replace(/'/g, "''");
    db.exec(`VACUUM INTO '${seguro}'`);
  } finally { db.close(); }
  if (!integridad(destino)) throw new Error('La copia de respaldo no supera PRAGMA integrity_check.');
  let copiaExterna = null;
  if (externo) {
    if (!claveExterna) throw new Error('BACKUP_EXTERNO_CLAVE es obligatoria cuando se configura BACKUP_EXTERNO_RUTA.');
    fs.mkdirSync(externo, { recursive: true });
    copiaExterna = cifrarCopia(destino, path.resolve(externo, `${path.basename(destino)}.enc`), claveExterna);
    const descifrada = descifrarCopia(copiaExterna, claveExterna);
    if (!descifrada.equals(fs.readFileSync(destino))) throw new Error('La copia externa cifrada no pudo verificarse.');
  }
  return { archivo: destino, copiaExterna, integridad: 'ok', rotacion: rotar(directorio, ahora) };
}

if (require.main === module) {
  try { console.log(JSON.stringify(respaldar())); } catch (error) { console.error(JSON.stringify({ error: error.message })); process.exitCode = 1; }
}

module.exports = { respaldar, integridad, rotar, rutaBase, cifrarCopia, descifrarCopia };
