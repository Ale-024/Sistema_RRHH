/**
 * Convenciones de tiempo para Honduras (America/Tegucigalpa, UTC-6 todo el ano).
 * El servidor puede vivir en UTC: los dias de asistencia y las horas de los
 * marcajes se resuelven SIEMPRE contra el reloj de Honduras.
 *
 * Convencion de almacenamiento: RegistroAsistencia.fecha guarda el dia de
 * calendario hondureno como medianoche UTC (renderiza bien con timeZone UTC).
 */
const ZONA_HONDURAS = 'America/Tegucigalpa';

/**
 * Dia de calendario en Honduras -> Date a medianoche UTC.
 * Ej.: marcaje a 7 PM del 24/8 (01:00 UTC del 25/8) -> 24/8.
 */
function fechaDiaHonduras(fecha = new Date()) {
  const iso = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HONDURAS,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(fecha);
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * Minutos del dia segun el reloj de Honduras (para turnos y tardanza).
 * Ej.: 19:37 de Honduras -> 1177, sin importar el huso del servidor.
 */
function minutosDiaHonduras(fecha) {
  const partes = new Intl.DateTimeFormat('en-GB', {
    timeZone: ZONA_HONDURAS,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(fecha);
  const [h, m] = partes.split(':').map(Number);
  return h * 60 + m;
}

module.exports = { ZONA_HONDURAS, fechaDiaHonduras, minutosDiaHonduras };
