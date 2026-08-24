require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const nodemailer = require('nodemailer');

function usoDisco(ruta) {
  try {
    const stat = fs.statfsSync(ruta);
    return stat.blocks ? ((stat.blocks - stat.bavail) / stat.blocks) * 100 : null;
  } catch { return null; }
}

function revisar({ backupDir = process.env.BACKUP_RUTA ?? path.resolve('backups'), logFile = process.env.LOG_RUTA, ahora = new Date() } = {}) {
  const alertas = [];
  if (!fs.existsSync(backupDir)) alertas.push({ tipo: 'RESPALDO_AUSENTE', detalle: 'No existe el directorio de respaldos.' });
  else {
    const respaldos = fs.readdirSync(backupDir).filter((nombre) => /^sirh-.*\.db$/.test(nombre)).map((nombre) => fs.statSync(path.join(backupDir, nombre))).sort((a, b) => b.mtimeMs - a.mtimeMs);
    if (!respaldos.length || ahora.getTime() - respaldos[0].mtimeMs > 26 * 60 * 60 * 1000) alertas.push({ tipo: 'RESPALDO_ATRASADO', detalle: 'No hay un respaldo verificado en las ultimas 26 horas.' });
  }
  const porcentajeDisco = usoDisco(backupDir);
  if (porcentajeDisco !== null && porcentajeDisco > 80) alertas.push({ tipo: 'DISCO_ALTO', detalle: `El volumen de respaldos utiliza ${porcentajeDisco.toFixed(2)}%.`, porcentaje: porcentajeDisco });
  if (logFile && fs.existsSync(logFile)) {
    const lineas = fs.readFileSync(logFile, 'utf8').split(/\r?\n/).filter(Boolean).slice(-1000);
    const errores = lineas.filter((linea) => { try { return JSON.parse(linea).nivel === 'error'; } catch { return false; } }).length;
    if (errores >= 20) alertas.push({ tipo: 'TASA_ERROR_ALTA', detalle: `${errores} errores en las ultimas ${lineas.length} entradas.` });
  }
  return { ok: alertas.length === 0, alertas, revisadoEn: ahora.toISOString() };
}

async function notificarPorCorreo(resultado, entorno = process.env) {
  if (resultado.ok) return { enviado: false, motivo: 'SIN_ALERTAS' };
  if (!entorno.SMTP_HOST || !entorno.ALERTA_TO) return { enviado: false, motivo: 'SMTP_NO_CONFIGURADO' };
  const transporte = nodemailer.createTransport({
    host: entorno.SMTP_HOST,
    port: Number(entorno.SMTP_PORT ?? 587),
    secure: entorno.SMTP_SECURE === 'true',
    auth: entorno.SMTP_USER ? { user: entorno.SMTP_USER, pass: entorno.SMTP_PASSWORD } : undefined,
  });
  await transporte.sendMail({
    from: entorno.ALERTA_FROM ?? entorno.SMTP_USER,
    to: entorno.ALERTA_TO,
    subject: '[SIRH-MKT] Alerta operativa',
    text: JSON.stringify(resultado, null, 2),
  });
  return { enviado: true };
}

if (require.main === module) {
  (async () => {
    const resultado = revisar();
    const notificacion = await notificarPorCorreo(resultado);
    console.log(JSON.stringify({ ...resultado, notificacion }));
    if (!resultado.ok) process.exitCode = 1;
  })().catch((error) => { console.error(JSON.stringify({ error: error.message })); process.exitCode = 1; });
}

module.exports = { revisar, notificarPorCorreo, usoDisco };
