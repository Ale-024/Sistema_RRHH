const { ErrorAplicacion } = require('../../../shared/dominio/errores');
const { hashEvento } = require('./hash-evento');
const { consolidarDia } = require('./consolidar-dia.usecase');

/**
 * CU02 - Marcaje propio del empleado (web o movil responsivo).
 * El tipo (ENTRADA/SALIDA) se deriva del estado del dia: si existe
 * marcaje de entrada sin salida, el siguiente es SALIDA.
 * Los umbrales de tardanza ya no viven aqui: los resuelve el consolidado
 * contra el turno asignado.
 */
async function registrarMarcaje(empleadoId, { latitud, longitud, proyectoId, dispositivo }, ctx) {
  const { prisma, clock, bus } = ctx;
  const ahora = clock.ahora();

  // RF-16 / CU02.2: el marcaje de campo solo puede referenciar un proyecto
  // efectivamente asignado al empleado (agregacion Proyecto-Empleado).
  if (proyectoId != null) {
    const asignacion = await prisma.asignacionProyecto.findFirst({
      where: {
        empleadoId,
        proyectoId,
        OR: [{ hasta: null }, { hasta: { gt: ahora } }],
      },
      select: { id: true },
    });
    if (!asignacion) {
      throw new ErrorAplicacion(
        'PROYECTO_NO_ASIGNADO',
        422,
        'El proyecto indicado no esta asignado a tu expediente.'
      );
    }
  }

  const inicioDia = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const finDia = new Date(inicioDia);
  finDia.setDate(finDia.getDate() + 1);

  // Un dia cerrado es inmutable: ni marcajes ni recalculos. Correcciones
  // posteriores pasan por RRHH (reabrir dia -> corregir -> cerrar).
  const registroDelDia = await prisma.registroAsistencia.findUnique({
    where: { empleadoId_fecha: { empleadoId, fecha: inicioDia } },
    select: { cerrado: true },
  });
  if (registroDelDia?.cerrado) {
    throw new ErrorAplicacion(
      'DIA_CERRADO',
      409,
      'El dia ya fue cerrado. Solicita a RRHH una correccion de asistencia.'
    );
  }

  // Tipo derivado del ORDEN real de eventos: si la ultima marca es una
  // entrada sin salida posterior, corresponde SALIDA; en otro caso,
  // ENTRADA (incluye iniciar un nuevo ciclo tras una salida).
  const marcajesHoy = await prisma.marcaje.findMany({
    where: { empleadoId, ocurridoEn: { gte: inicioDia, lt: finDia } },
    orderBy: { ocurridoEn: 'asc' },
    select: { tipo: true, ocurridoEn: true },
  });
  const ultimaEntrada = [...marcajesHoy].reverse().find((m) => m.tipo === 'ENTRADA');
  const haySalidaDespues =
    ultimaEntrada &&
    marcajesHoy.some((m) => m.tipo === 'SALIDA' && m.ocurridoEn > ultimaEntrada.ocurridoEn);

  // Antirrepeticion inmediata (doble toque accidental). Configurable
  // por entorno; en pruebas se fija en 0. Aplica al ULTIMO marcaje de
  // cualquier tipo: tambien evita duplicados tras completar un ciclo.
  const segundosAntirrepeticion = Number(ctx.entorno?.SEGUNDOS_ANTIRREPETICION ?? 60);
  const ultimoMarcaje = await prisma.marcaje.findFirst({
    where: { empleadoId, ocurridoEn: { gte: inicioDia, lt: finDia } },
    orderBy: { ocurridoEn: 'desc' },
  });
  if (
    segundosAntirrepeticion > 0 &&
    ultimoMarcaje &&
    ultimoMarcaje.ocurridoEn > new Date(ahora - segundosAntirrepeticion * 1000)
  ) {
    throw new ErrorAplicacion(
      'MARCAJE_REPETIDO',
      400,
      'Acabas de registrar un marcaje. Espera un momento.'
    );
  }

  const tipo = ultimaEntrada && !haySalidaDespues ? 'SALIDA' : 'ENTRADA';

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
        proyectoId: proyectoId ?? null,
        hashEvento: hashEvento(empleadoId, ahora, tipo),
      },
    });

    bus.publicar('MarcajeRegistrado', { empleadoId, tipo });
    // Auto-consolidacion del dia: el registro diario (con hora de entrada
    // y salida) queda visible de inmediato para empleado y supervisor.
    // Es idempotente; un fallo aqui no revierte el marcaje ya guardado.
    try {
      await consolidarDia(ahora, ctx);
    } catch (errorConsolidacion) {
      console.error('Auto-consolidacion post-marcaje fallo:', errorConsolidacion.message);
    }
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
