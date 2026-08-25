const { ErrorAplicacion } = require('../../../shared/dominio/errores');
const { SolicitudPermiso } = require('../domain/solicitud-permiso');

const ESTADOS_RESERVA = ['EN_REVISION', 'APROBADO'];
const ESTADOS_CONSUMO_TOPE = ['EN_REVISION', 'APROBADO'];

function inicioDelDia(fecha) {
  const resultado = new Date(fecha);
  resultado.setHours(0, 0, 0, 0);
  return resultado;
}

function finDelDia(fecha) {
  const resultado = inicioDelDia(fecha);
  resultado.setHours(23, 59, 59, 999);
  return resultado;
}

function diasHabilesEntre(inicio, fin) {
  let total = 0;
  const cursor = inicioDelDia(inicio);
  const limite = inicioDelDia(fin);
  while (cursor <= limite) {
    const dia = cursor.getDay();
    if (dia !== 0 && dia !== 6) total += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return total;
}

function validarRango(fechaInicio, fechaFin) {
  if (!(fechaInicio instanceof Date) || Number.isNaN(fechaInicio.getTime())) {
    throw new ErrorAplicacion('DATOS_INVALIDOS', 422, 'La fecha inicial no es valida.');
  }
  if (!(fechaFin instanceof Date) || Number.isNaN(fechaFin.getTime())) {
    throw new ErrorAplicacion('DATOS_INVALIDOS', 422, 'La fecha final no es valida.');
  }
  if (finDelDia(fechaFin) < inicioDelDia(fechaInicio)) {
    throw new ErrorAplicacion(
      'RANGO_INVALIDO',
      422,
      'La fecha final no puede ser anterior a la fecha inicial.'
    );
  }
}

async function obtenerTipoActivo(tx, tipoPermisoId) {
  const tipo = await tx.tipoPermiso.findUnique({ where: { id: tipoPermisoId } });
  if (!tipo || !tipo.activo) {
    throw new ErrorAplicacion('TIPO_PERMISO_INVALIDO', 422, 'El tipo de permiso no esta activo.');
  }
  return tipo;
}

async function validarTopeAnual(tx, { empleadoId, tipoPermisoId, diasHabiles, excluirId }) {
  const tipo = await obtenerTipoActivo(tx, tipoPermisoId);
  if (tipo.diasMaxAnio == null) return tipo;

  const ahora = new Date();
  const inicioAnio = new Date(ahora.getFullYear(), 0, 1);
  const finAnio = new Date(ahora.getFullYear(), 11, 31, 23, 59, 59, 999);
  const existentes = await tx.solicitudPermiso.findMany({
    where: {
      empleadoId,
      tipoPermisoId,
      estado: { in: ESTADOS_CONSUMO_TOPE },
      fechaInicio: { lte: finAnio },
      fechaFin: { gte: inicioAnio },
      ...(excluirId ? { NOT: { id: excluirId } } : {}),
    },
    select: { diasHabiles: true },
  });
  const consumidos = existentes.reduce((total, solicitud) => total + solicitud.diasHabiles, 0);
  if (consumidos + diasHabiles > tipo.diasMaxAnio) {
    throw new ErrorAplicacion(
      'TOPE_ANUAL_EXCEDIDO',
      422,
      `El tipo ${tipo.codigo} permite como maximo ${tipo.diasMaxAnio} dias por año.`
    );
  }
  return tipo;
}

async function validarSolapamiento(tx, { empleadoId, fechaInicio, fechaFin, excluirId }) {
  const existente = await tx.solicitudPermiso.findFirst({
    where: {
      empleadoId,
      estado: { in: ESTADOS_RESERVA },
      fechaInicio: { lte: finDelDia(fechaFin) },
      fechaFin: { gte: inicioDelDia(fechaInicio) },
      ...(excluirId ? { NOT: { id: excluirId } } : {}),
    },
    select: { folio: true },
  });
  if (existente) {
    throw new ErrorAplicacion(
      'PERMISO_SOLAPADO',
      409,
      `El rango se solapa con la solicitud ${existente.folio}.`
    );
  }
}

async function siguienteFolio(tx, fecha = new Date()) {
  const anio = fecha.getFullYear();
  const ultimo = await tx.solicitudPermiso.findFirst({
    where: { folio: { startsWith: `PER-${anio}-` } },
    orderBy: { id: 'desc' },
    select: { folio: true },
  });
  const secuencia = ultimo ? Number(ultimo.folio.split('-').pop()) + 1 : 1;
  return `PER-${anio}-${String(secuencia).padStart(6, '0')}`;
}

async function crearSolicitud({ prisma, empleadoId, usuarioId, datos, ip }) {
    const fechaInicio = inicioDelDia(datos.fechaInicio);
    const fechaFin = inicioDelDia(datos.fechaFin);
    validarRango(fechaInicio, fechaFin);

    // Doble clic / reenvio accidental: un borrador identico (mismo tipo,
    // fechas y motivo) ya creado y aun no resuelto bloquea la creacion.
    const duplicado = await prisma.solicitudPermiso.findFirst({
      where: {
        empleadoId,
        tipoPermisoId: datos.tipoPermisoId,
        fechaInicio: fechaInicio,
        fechaFin: fechaFin,
        motivo: datos.motivo ?? null,
        estado: 'SOLICITADO',
      },
      select: { id: true, folio: true },
    });
    if (duplicado) {
      throw new ErrorAplicacion(
        'SOLICITUD_DUPLICADA',
        409,
        `Ya existe una solicitud identica en borrador (${duplicado.folio}). Enviala o cancelala primero.`
      );
    }
  
  return prisma.$transaction(async (tx) => {
    const tipo = await obtenerTipoActivo(tx, datos.tipoPermisoId);
    const diasHabiles = diasHabilesEntre(fechaInicio, fechaFin);
    if (diasHabiles < 1) {
      throw new ErrorAplicacion('RANGO_SIN_DIAS_HABILES', 422, 'El rango no contiene dias habiles.');
    }
    if (tipo.requiereSoporte && !datos.soporteRuta) {
      throw new ErrorAplicacion(
        'SOPORTE_REQUERIDO',
        422,
        `El tipo ${tipo.codigo} requiere adjuntar un soporte.`
      );
    }

    const solicitud = await tx.solicitudPermiso.create({
      data: {
        folio: await siguienteFolio(tx),
        empleadoId,
        tipoPermisoId: tipo.id,
        fechaInicio,
        fechaFin,
        horaInicio: datos.horaInicio ?? null,
        horaFin: datos.horaFin ?? null,
        diasHabiles,
        motivo: datos.motivo,
        soporteRuta: datos.soporteRuta ?? null,
        estado: 'SOLICITADO',
      },
      include: { tipoPermiso: true },
    });

    await tx.permisoHistorialEstado.create({
      data: {
        permisoId: solicitud.id,
        estadoNuevo: 'SOLICITADO',
        usuarioId,
        motivo: 'Solicitud creada',
        ip,
      },
    });
    return solicitud;
  });
}

async function cambiarEstado({ prisma, id, destino, usuarioId, motivo, ip, ahora = new Date() }) {
  return prisma.$transaction(async (tx) => {
    const actual = await tx.solicitudPermiso.findUnique({
      where: { id },
      include: { tipoPermiso: true },
    });
    if (!actual) {
      throw new ErrorAplicacion('NO_ENCONTRADO', 404, 'Solicitud de permiso no encontrada.');
    }

    const agregado = new SolicitudPermiso(actual);
    const transicion = agregado.transicionar(destino);

    if (destino === 'RECHAZADO' && !motivo?.trim()) {
      throw new ErrorAplicacion('MOTIVO_REQUERIDO', 422, 'El rechazo requiere un motivo.');
    }
    if (destino === 'SOLICITADO' && !motivo?.trim()) {
      throw new ErrorAplicacion('MOTIVO_REQUERIDO', 422, 'La solicitud de correccion requiere una observacion.');
    }
    if (ESTADOS_RESERVA.includes(destino)) {
      await validarSolapamiento(tx, {
        empleadoId: actual.empleadoId,
        fechaInicio: actual.fechaInicio,
        fechaFin: actual.fechaFin,
        excluirId: actual.id,
      });
      await validarTopeAnual(tx, {
        empleadoId: actual.empleadoId,
        tipoPermisoId: actual.tipoPermisoId,
        diasHabiles: actual.diasHabiles,
        excluirId: actual.id,
      });
    }

    const actualizada = await tx.solicitudPermiso.update({
      where: { id },
      data: {
        estado: destino,
        ...(destino === 'APROBADO' || destino === 'RECHAZADO'
          ? { revisadoPor: usuarioId, revisadoEn: ahora, observacionRevision: motivo ?? null }
          : destino === 'SOLICITADO'
            ? { revisadoPor: null, revisadoEn: null, observacionRevision: motivo }
            : {}),
      },
      include: { tipoPermiso: true },
    });
    await tx.permisoHistorialEstado.create({
      data: {
        permisoId: id,
        estadoAnterior: transicion.anterior,
        estadoNuevo: transicion.nuevo,
        usuarioId,
        motivo: motivo ?? null,
        ip,
        ocurridoEn: ahora,
      },
    });
    return actualizada;
  });
}

async function actualizarSolicitud({ prisma, id, empleadoId, datos }) {
  const actual = await prisma.solicitudPermiso.findUnique({ where: { id } });
  if (!actual || actual.empleadoId !== empleadoId) {
    throw new ErrorAplicacion('NO_ENCONTRADO', 404, 'Solicitud de permiso no encontrada.');
  }
  if (actual.estado !== 'SOLICITADO') {
    throw new ErrorAplicacion('CONFLICTO_ESTADO', 409, 'Solo pueden editarse solicitudes en estado SOLICITADO.');
  }
  const fechaInicio = inicioDelDia(datos.fechaInicio ?? actual.fechaInicio);
  const fechaFin = inicioDelDia(datos.fechaFin ?? actual.fechaFin);
  validarRango(fechaInicio, fechaFin);
  return prisma.solicitudPermiso.update({
    where: { id },
    data: {
      fechaInicio,
      fechaFin,
      diasHabiles: diasHabilesEntre(fechaInicio, fechaFin),
      motivo: datos.motivo ?? actual.motivo,
      soporteRuta: datos.soporteRuta ?? actual.soporteRuta,
      horaInicio: datos.horaInicio ?? actual.horaInicio,
      horaFin: datos.horaFin ?? actual.horaFin,
    },
    include: { tipoPermiso: true },
  });
}

module.exports = {
  cambiarEstado,
  crearSolicitud,
  actualizarSolicitud,
  diasHabilesEntre,
  inicioDelDia,
};
