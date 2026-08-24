require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
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

function respaldar({ databaseUrl = process.env.DATABASE_URL, directorio = process.env.BACKUP_RUTA ?? path.resolve('backups'), ahora = new Date() } = {}) {
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
  return { archivo: destino, integridad: 'ok', rotacion: rotar(directorio, ahora) };
}

if (require.main === module) {
  try { console.log(JSON.stringify(respaldar())); } catch (error) { console.error(JSON.stringify({ error: error.message })); process.exitCode = 1; }
}

module.exports = { respaldar, integridad, rotar, rutaBase };
