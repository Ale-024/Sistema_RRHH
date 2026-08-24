const { ErrorAplicacion } = require('../../../shared/dominio/errores');
const { hashEvento } = require('./hash-evento');

/**
 * CU02 - Marcaje propio del empleado (web o movil responsivo).
 * El tipo (ENTRADA/SALIDA) se deriva del estado del dia: si existe
 * marcaje de entrada sin salida, el siguiente es SALIDA.
 * Los umbrales de tardanza ya no viven aqui: los resuelve el consolidado
 * contra el turno asignado.
 */
async function registrarMarcaje(empleadoId, { latitud, longitud, dispositivo }, ctx) {
  const { prisma, clock, bus } = ctx;
  const ahora = clock.ahora();

  const inicioDia = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const finDia = new Date(inicioDia);
  finDia.setDate(finDia.getDate() + 1);

  // Ultima salida y ultima entrada del dia para decidir el tipo.
  const ultimaSalida = await prisma.marcaje.findFirst({
    where: { empleadoId, ocurridoEn: { gte: inicioDia, lt: finDia }, tipo: 'SALIDA' },
    orderBy: { ocurridoEn: 'desc' },
  });
  const ultimaEntrada = ultimaSalida
    ? null
    : await prisma.marcaje.findFirst({
        where: { empleadoId, ocurridoEn: { gte: inicioDia, lt: finDia }, tipo: 'ENTRADA' },
        orderBy: { ocurridoEn: 'desc' },
      });

  // Antirrepeticion inmediata (doble toque accidental). Configurable
  // por entorno; en pruebas se fija en 0.
  const segundosAntirrepeticion = Number(ctx.entorno?.SEGUNDOS_ANTIRREPETICION ?? 60);
  if (
    segundosAntirrepeticion > 0 &&
    ultimaEntrada &&
    ultimaEntrada.ocurridoEn > new Date(ahora - segundosAntirrepeticion * 1000)
  ) {
    throw new ErrorAplicacion(
      'MARCAJE_REPETIDO',
      400,
      'Acabas de registrar un marcaje. Espera un momento.'
    );
  }

  const tipo = ultimaEntrada ? 'SALIDA' : 'ENTRADA';

  try {
    const marcaje = await prisma.marcaje.create({
      data: {
        empleadoId,
        ocurridoEn: ahora,
        tipo,
        origen: latitud != null ? 'MOVIL' : 'WEB',
        dispositivo: dispositivo ?? 'web',
        latitud: latitud ?? null,
        longitud: longitud ?? null,
        hashEvento: hashEvento(empleadoId, ahora, tipo),
      },
    });

    bus.publicar('MarcajeRegistrado', { empleadoId, tipo });
    return {
      message: tipo === 'ENTRADA' ? 'Entrada registrada' : 'Salida registrada',
      data: marcaje,
    };
  } catch (error) {
    // Colision de hashEvento: el mismo marcaje ya fue registrado.
    if (error.code === 'P2002') {
      throw new ErrorAplicacion(
        'MARCAJE_DUPLICADO',
        409,
        'Este marcaje ya fue registrado.'
      );
    }
    throw error;
  }
}

module.exports = { registrarMarcaje };
