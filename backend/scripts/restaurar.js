require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { integridad, rutaBase, descifrarCopia } = require('./respaldar');

function restaurar({ respaldo, destino = rutaBase(process.env.DATABASE_URL), confirmar = false, claveExterna = process.env.BACKUP_EXTERNO_CLAVE } = {}) {
  if (!confirmar) throw new Error('La restauracion requiere confirmar: --confirmar.');
  if (!respaldo || !fs.existsSync(respaldo)) throw new Error('El archivo de respaldo no existe.');
  let archivoRestaurable = respaldo;
  let temporal = null;
  if (respaldo.endsWith('.enc')) {
    temporal = fs.mkdtempSync(path.join(os.tmpdir(), 'sirh-restaurar-'));
    archivoRestaurable = path.join(temporal, 'respaldo.db');
    fs.writeFileSync(archivoRestaurable, descifrarCopia(respaldo, claveExterna));
  }
  if (!integridad(archivoRestaurable)) throw new Error('El respaldo no supera PRAGMA integrity_check.');
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.copyFileSync(archivoRestaurable, destino);
  if (!integridad(destino)) throw new Error('La base restaurada no supera PRAGMA integrity_check.');
  if (temporal) fs.rmSync(temporal, { recursive: true, force: true });
  return { destino, respaldo, integridad: 'ok' };
}

if (require.main === module) {
  const respaldo = process.argv[2];
  const confirmar = process.argv.includes('--confirmar');
  try { console.log(JSON.stringify(restaurar({ respaldo, confirmar }))); } catch (error) { console.error(JSON.stringify({ error: error.message })); process.exitCode = 1; }
}

module.exports = { restaurar };
