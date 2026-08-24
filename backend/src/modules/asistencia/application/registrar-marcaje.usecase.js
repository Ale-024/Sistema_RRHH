const { ErrorAplicacion } = require('../../../shared/dominio/errores');

/**
 * Registro de marcaje del MVP: un par entrada/salida por dia.
 * Nota (Fase 3 lo reemplaza): los umbrales de tardanza estan fijados
 * en codigo; pasaran a la tabla Turno.
 */
async function registrarMarcaje(empleadoId, ahora, { prisma, bus }) {
  const inicioDia = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const finDia = new Date(inicioDia);
  finDia.setDate(finDia.getDate() + 1);

  const existente = await prisma.asistencia.findFirst({
    where: {
      empleado_id: empleadoId,
      fecha_hora_entrada: { gte: inicioDia, lt: finDia },
    },
  });

  if (existente) {
    if (!existente.fecha_hora_salida) {
      const actualizada = await prisma.asistencia.update({
        where: { id: existente.id },
        data: { fecha_hora_salida: ahora },
      });
      return { message: 'Salida registrada', data: actualizada };
    }
    throw new ErrorAplicacion(
      'MARCAJE_DUPLICADO',
      400,
      'Ya registraste entrada y salida hoy.'
    );
  }

  const hora = ahora.getHours();
  const minutos = ahora.getMinutes();
  let estado = 'FALTA';

  if (hora < 9 || (hora === 9 && minutos <= 15)) {
    estado = 'PRESENTE';
  } else if (hora < 10) {
    estado = 'RETARDO';
  }

  const asistencia = await prisma.asistencia.create({
    data: {
      empleado_id: empleadoId,
      fecha_hora_entrada: ahora,
      estado,
    },
  });

  bus.publicar('MarcajeRegistrado', { empleadoId, estado });
  return { message: 'Entrada registrada', data: asistencia };
}

module.exports = { registrarMarcaje };
