const { ErrorAplicacion } = require('../../../shared/dominio/errores');
const auditoria = require('../../auditoria/application/auditoria.service');

/**
 * Cierre de dias: bloquea la edicion (ademas del trigger de BD).
 * La reapertura exige motivo y queda auditada.
 */
async function cerrarDias({ desde, hasta }, contexto, ctx) {
  const { prisma } = ctx;
  if (desde > hasta) {
    throw new ErrorAplicacion('RANGO_INVALIDO', 422, 'El rango de fechas es invalido.');
  }
  const resultado = await prisma.registroAsistencia.updateMany({
    where: { fecha: { gte: desde, lte: hasta }, cerrado: false },
    data: { cerrado: true, cerradoPor: contexto.usuarioId, cerradoEn: new Date() },
  });

  await auditoria.registrar(prisma, {
    usuarioId: contexto.usuarioId,
    entidad: 'RegistroAsistencia',
    accion: 'CERRAR_DIAS',
    despues: { desde, hasta, cantidad: resultado.count },
    ip: contexto.ip,
    requestId: contexto.requestId,
  });
  return { message: `Se cerraron ${resultado.count} registros.`, cantidad: resultado.count };
}

async function reabrirDia({ empleadoId, fecha, motivo }, contexto, ctx) {
  const { prisma } = ctx;
  if (!motivo || motivo.trim().length < 10) {
    throw new ErrorAplicacion(
      'MOTIVO_OBLIGATORIO',
      422,
      'La reapertura exige un motivo de al menos 10 caracteres.'
    );
  }

  const registro = await prisma.registroAsistencia.findUnique({
    where: { empleadoId_fecha: { empleadoId, fecha } },
  });
  if (!registro) {
    throw new ErrorAplicacion('NO_ENCONTRADO', 404, 'No existe registro para esa fecha.');
  }
  if (!registro.cerrado) {
    throw new ErrorAplicacion('NO_CERRADO', 409, 'El dia no esta cerrado.');
  }

  // La transicion cerrado=1 -> cerrado=0 esta permitida por el trigger.
  await prisma.registroAsistencia.update({
    where: { id: registro.id },
    data: { cerrado: false },
  });

  await auditoria.registrar(prisma, {
    usuarioId: contexto.usuarioId,
    entidad: 'RegistroAsistencia',
    entidadId: registro.id,
    accion: 'REABRIR_DIA',
    antes: { cerrado: true },
    despues: { cerrado: false, motivo },
    ip: contexto.ip,
    requestId: contexto.requestId,
  });
  return { message: 'Dia reabierto con motivo registrado.' };
}

/**
 * Correccion manual justificada sobre un dia abierto.
 * El antes/despues queda en auditoria; el trigger impide tocar cerrados.
 */
async function corregirRegistro(id, datos, contexto, ctx) {
  const { prisma } = ctx;
  const anterior = await prisma.registroAsistencia.findUnique({ where: { id } });
  if (!anterior) throw new ErrorAplicacion('NO_ENCONTRADO', 404, 'Registro no encontrado.');
  if (anterior.cerrado) {
    throw new ErrorAplicacion(
      'DIA_CERRADO',
      409,
      'El dia esta cerrado. Reabra el dia con motivo antes de corregirlo.'
    );
  }

  try {
    await prisma.registroAsistencia.update({
      where: { id },
      data: {
        ...(datos.horaEntrada !== undefined ? { horaEntrada: datos.horaEntrada } : {}),
        ...(datos.horaSalida !== undefined ? { horaSalida: datos.horaSalida } : {}),
        ...(datos.estadoDia !== undefined ? { estadoDia: datos.estadoDia } : {}),
        observacion: datos.motivo,
      },
    });
  } catch (error) {
    // El trigger de BD es la segunda barrera ante condiciones de carrera.
    if (String(error.message).includes('ASISTENCIA_DIA_CERRADO')) {
      throw new ErrorAplicacion('DIA_CERRADO', 409, 'El dia acaba de ser cerrado.');
    }
    throw error;
  }

  await auditoria.registrar(prisma, {
    usuarioId: contexto.usuarioId,
    entidad: 'RegistroAsistencia',
    entidadId: id,
    accion: 'CORREGIR',
    antes: {
      horaEntrada: anterior.horaEntrada,
      horaSalida: anterior.horaSalida,
      estadoDia: anterior.estadoDia,
    },
    despues: { ...datos },
    ip: contexto.ip,
    requestId: contexto.requestId,
  });

  return prisma.registroAsistencia.findUnique({ where: { id } });
}

module.exports = { cerrarDias, reabrirDia, corregirRegistro };
