require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');

function revisar({ backupDir = process.env.BACKUP_RUTA ?? path.resolve('backups'), logFile = process.env.LOG_RUTA, ahora = new Date() } = {}) {
  const alertas = [];
  if (!fs.existsSync(backupDir)) alertas.push({ tipo: 'RESPALDO_AUSENTE', detalle: 'No existe el directorio de respaldos.' });
  else {
    const respaldos = fs.readdirSync(backupDir).filter((nombre) => /^sirh-.*\.db$/.test(nombre)).map((nombre) => fs.statSync(path.join(backupDir, nombre))).sort((a, b) => b.mtimeMs - a.mtimeMs);
    if (!respaldos.length || ahora.getTime() - respaldos[0].mtimeMs > 26 * 60 * 60 * 1000) alertas.push({ tipo: 'RESPALDO_ATRASADO', detalle: 'No hay un respaldo verificado en las ultimas 26 horas.' });
  }
  if (logFile && fs.existsSync(logFile)) {
    const lineas = fs.readFileSync(logFile, 'utf8').split(/\r?\n/).filter(Boolean).slice(-1000);
    const errores = lineas.filter((linea) => { try { return JSON.parse(linea).nivel === 'error'; } catch { return false; } }).length;
    if (errores >= 20) alertas.push({ tipo: 'TASA_ERROR_ALTA', detalle: `${errores} errores en las ultimas ${lineas.length} entradas.` });
  }
  return { ok: alertas.length === 0, alertas, revisadoEn: ahora.toISOString() };
}

if (require.main === module) {
  const resultado = revisar();
  console.log(JSON.stringify(resultado));
  if (!resultado.ok) process.exitCode = 1;
}

module.exports = { revisar };
