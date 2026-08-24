require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const { integridad, rutaBase } = require('./respaldar');

function restaurar({ respaldo, destino = rutaBase(process.env.DATABASE_URL), confirmar = false } = {}) {
  if (!confirmar) throw new Error('La restauracion requiere confirmar: --confirmar.');
  if (!respaldo || !fs.existsSync(respaldo)) throw new Error('El archivo de respaldo no existe.');
  if (!integridad(respaldo)) throw new Error('El respaldo no supera PRAGMA integrity_check.');
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.copyFileSync(respaldo, destino);
  if (!integridad(destino)) throw new Error('La base restaurada no supera PRAGMA integrity_check.');
  return { destino, respaldo, integridad: 'ok' };
}

if (require.main === module) {
  const respaldo = process.argv[2];
  const confirmar = process.argv.includes('--confirmar');
  try { console.log(JSON.stringify(restaurar({ respaldo, confirmar }))); } catch (error) { console.error(JSON.stringify({ error: error.message })); process.exitCode = 1; }
}

module.exports = { restaurar };
