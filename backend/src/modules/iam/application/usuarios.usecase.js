const { ErrorAplicacion } = require('../../../shared/dominio/errores');
const {
  VIGENCIA_AUTORIZACION_DIAS,
  validarSolicitud,
  validarDecision,
  validarEjecucion,
  validarRevocacion,
} = require('./autoridad-roles');

/**
 * Gestion de usuarios y roles (permiso usuarios:administrar).
 * La asignacion/revocacion exige ejecutor explicito y aplica el
 * Anexo de autoridad (matriz + invariantes 1-8).
 */

async function listarUsuarios(ctx) {
  return ctx.prisma.usuario.findMany({
    select: {
      id: true,
      email: true,
      estado: true,
      ultimoAcceso: true,
      debeCambiarPassword: true,
      empleado: { select: { nombres: true, apellidos: true } },
      roles: {
        select: { rol: { select: { codigo: true, nombre: true, nivelAutoridad: true } }, scopeDepartamentoId: true },
      },
    },
    orderBy: { id: 'asc' },
  });
}

/**
 * Ejecucion tecnica de la asignacion. El ejecutor es ADMIN_TI
 * (usuarios:administrar); los roles de nivel >= 30 exigen AutorizacionRol.
 */
async function asignarRol(usuarioId, { rolCodigo, scopeDepartamentoId, autorizacionId }, ctx) {
  const { prisma, ejecutor } = ctx;
  if (!ejecutor?.id) throw new ErrorAplicacion('EJECUTOR_AUSENTE', 500, 'Sesion sin ejecutor identificado.');

  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  if (!usuario) throw new ErrorAplicacion('NO_ENCONTRADO', 404, 'Usuario no encontrado.');

  const { rol, autorizacion } = await validarEjecucion(prisma, {
    ejecutorId: ejecutor.id,
    beneficiarioId: usuarioId,
    rolCodigo,
    scopeDepartamentoId,
    autorizacionId,
  });

  // Un solo rol por persona: el nuevo rol REEMPLAZA los anteriores.
  // Degradacion: otorgar un rol base a quien tiene uno elevado (nivel >= 30)
  // exige autorizacion previa de DIRECCION (el ADMIN no degrada por si solo).
  const rolesActuales = await prisma.usuarioRol.findMany({
    where: { usuarioId },
    include: { rol: { select: { nivelAutoridad: true } } },
  });
  const esDegradacion =
    rolesActuales.some((ur) => ur.rol.nivelAutoridad >= 30) && rol.nivelAutoridad < 30;

  // La degradacion exige autorizacion previa de DIRECCION con el mismo doble
  // control del otorgamiento (autorizador != ejecutor != beneficiario).
  let autorizacionDegradacion = null;
  if (esDegradacion) {
    autorizacionDegradacion = autorizacionId
      ? await prisma.autorizacionRol.findUnique({ where: { id: autorizacionId } })
      : null;
    const valida =
      autorizacionDegradacion &&
      autorizacionDegradacion.estado === 'AUTORIZADA' &&
      !autorizacionDegradacion.consumidaEn &&
      autorizacionDegradacion.beneficiarioId === usuarioId &&
      autorizacionDegradacion.rolId === rol.id &&
      (!autorizacionDegradacion.venceEn || autorizacionDegradacion.venceEn > new Date()) &&
      autorizacionDegradacion.autorizadaPorId != null &&
      autorizacionDegradacion.autorizadaPorId !== ejecutor.id &&
      autorizacionDegradacion.autorizadaPorId !== usuarioId;
    if (!valida) {
      throw new ErrorAplicacion(
        'DEGRADACION_SIN_AUTORIZACION',
        409,
        'Degradar un rol elevado exige autorizacion previa de Direccion General.'
      );
    }
  }

  // INV7 (trigger) protege al ultimo ADMIN_TI/DIRECCION de ser degradado.
  await prisma.$transaction(async (tx) => {
    await tx.usuarioRol.deleteMany({ where: { usuarioId } });
    await tx.usuarioRol.create({
      data: {
        usuarioId,
        rolId: rol.id,
        scopeDepartamentoId: scopeDepartamentoId ?? null,
        asignadoPorId: ejecutor.id,
      },
    });
  });

  // Cierra el ciclo: las autorizaciones quedan CONSUMIDAS y desaparecen de
  // la bandeja ejecutable (el trigger ya estampo consumidaEn en el INSERT).
  if (autorizacion) {
    await prisma.autorizacionRol.update({
      where: { id: autorizacion.id },
      data: { estado: 'CONSUMIDA', consumidaEn: new Date() },
    });
  }
  if (autorizacionDegradacion) {
    await prisma.autorizacionRol.update({
      where: { id: autorizacionDegradacion.id },
      data: { estado: 'CONSUMIDA', consumidaEn: new Date() },
    });
  }

  return {
    message: `Rol ${rolCodigo} asignado.`,
    ...(rol.nivelAutoridad >= 30 && autorizacionId ? { autorizacionConsumida: autorizacionId } : {}),
  };
}

async function quitarRol(usuarioId, rolId, ctx) {
  const { prisma, ejecutor } = ctx;
  if (!ejecutor?.id) throw new ErrorAplicacion('EJECUTOR_AUSENTE', 500, 'Sesion sin ejecutor identificado.');

  await validarRevocacion(prisma, { ejecutorId: ejecutor.id, beneficiarioId: usuarioId, rolId });

  // Quitar un rol ELEVADO (nivel >= 30) exige autorizacion REVOCAR de
  // DIRECCION: el ADMIN de TI no degrada por si solo.
  const rol = await prisma.rol.findUnique({ where: { id: rolId } });
  let autorizacionRevocacion = null;
  if (rol && rol.nivelAutoridad >= 30) {
    autorizacionRevocacion = ctx.autorizacionId
      ? await prisma.autorizacionRol.findUnique({ where: { id: ctx.autorizacionId } })
      : null;
    const valida =
      autorizacionRevocacion &&
      autorizacionRevocacion.accion === 'REVOCAR' &&
      autorizacionRevocacion.estado === 'AUTORIZADA' &&
      !autorizacionRevocacion.consumidaEn &&
      autorizacionRevocacion.beneficiarioId === usuarioId &&
      autorizacionRevocacion.rolId === rolId &&
      (!autorizacionRevocacion.venceEn || autorizacionRevocacion.venceEn > new Date()) &&
      autorizacionRevocacion.autorizadaPorId != null &&
      autorizacionRevocacion.autorizadaPorId !== ejecutor.id &&
      autorizacionRevocacion.autorizadaPorId !== usuarioId;
    if (!valida) {
      throw new ErrorAplicacion(
        'QUITAR_SIN_AUTORIZACION',
        409,
        'Quitar un rol elevado exige autorizacion previa de Direccion General.'
      );
    }
  }

  const restantes = await prisma.usuarioRol.count({ where: { usuarioId } });
  if (restantes <= 1) {
    throw new ErrorAplicacion('ULTIMO_ROL', 409, 'El usuario debe conservar al menos un rol.');
  }

  await prisma.usuarioRol.delete({
    where: { usuarioId_rolId: { usuarioId, rolId } },
  });

  if (autorizacionRevocacion) {
    await prisma.autorizacionRol.update({
      where: { id: autorizacionRevocacion.id },
      data: { estado: 'CONSUMIDA', consumidaEn: new Date() },
    });
  }
  return { message: 'Rol retirado.' };
}

/**
 * Paso 1 del flujo para roles elevados: la solicitud segun matriz.
 * EMPLEADO/ENCUESTADOR: RRHH_SUP. RRHH_SUP: DIRECCION. ADMIN_TI: otro ADMIN_TI.
 * GERENTE_DEPTO: RRHH_SUP. DIRECCION: otro DIRECCION.
 */
async function solicitarAutorizacion({ beneficiarioId, email, rolCodigo, accion = 'OTORGAR', scopeDepartamentoId, motivo }, ctx) {
    const { prisma, ejecutor } = ctx;
    if (!ejecutor?.id || !Array.isArray(ejecutor.roles)) {
      throw new ErrorAplicacion('EJECUTOR_AUSENTE', 500, 'Sesion sin roles identificables.');
    }
    if (!['OTORGAR', 'REVOCAR'].includes(accion)) {
      throw new ErrorAplicacion('DATOS_INVALIDOS', 422, "Accion invalida: use 'OTORGAR' o 'REVOCAR'.");
    }

    const rol = await prisma.rol.findUnique({ where: { codigo: rolCodigo } });
    if (!rol) throw new ErrorAplicacion('ROL_INVALIDO', 422, 'El rol indicado no existe.');

    validarSolicitud(ejecutor.roles.map((r) => r.codigo ?? r), rol.codigo);

  // Resolucion del beneficiario: por id o por correo (DIRECCION no maneja
  // listados de usuarios; el formulario le permite escribir el correo).
  let beneficiario = null;
  if (beneficiarioId) {
    beneficiario = await prisma.usuario.findUnique({ where: { id: beneficiarioId } });
  } else if (email) {
    beneficiario = await prisma.usuario.findUnique({ where: { email: email.toLowerCase() } });
  } else {
    throw new ErrorAplicacion('DATOS_INVALIDOS', 422, 'Indica el beneficiario (id o correo).');
  }
    if (!beneficiario) throw new ErrorAplicacion('NO_ENCONTRADO', 404, 'Usuario beneficiario no encontrado.');

    // REVOCAR: el beneficiario debe tener el rol actualmente.
    if (accion === 'REVOCAR') {
      const tieneRol = await prisma.usuarioRol.findUnique({
        where: { usuarioId_rolId: { usuarioId: beneficiario.id, rolId: rol.id } },
      });
      if (!tieneRol) {
        throw new ErrorAplicacion(
          'ROL_NO_ASIGNADO',
          422,
          `El beneficiario no tiene el rol ${rolCodigo}; no hay nada que revocar.`
        );
      }
    }

    const yaVigente = await prisma.autorizacionRol.findFirst({
      where: { beneficiarioId: beneficiario.id, rolId: rol.id, accion, estado: 'AUTORIZADA', consumidaEn: null },
    });
  if (yaVigente) {
    throw new ErrorAplicacion(
      'AUTORIZACION_YA_VIGENTE',
      409,
      'Ya existe una autorizacion vigente para este rol y beneficiario.'
    );
  }

  const venceEn = new Date(Date.now() + VIGENCIA_AUTORIZACION_DIAS * 24 * 60 * 60 * 1000);
  const solicitud = await prisma.autorizacionRol.create({
    data: {
      beneficiarioId: beneficiario.id,
      rolId: rol.id,
      accion,
      scopeDepartamentoId: scopeDepartamentoId ?? null,
      solicitadaPorId: ejecutor.id,
      motivo: motivo ?? null,
      venceEn,
    },
  });

  return {
    message: `${accion === 'REVOCAR' ? 'Revocacion' : 'Solicitud'} de rol ${rolCodigo} registrada.`,
    data: { id: solicitud.id, venceEn },
  };
}

/**
 * Paso 2: DIRECCION decide (o quien indique la matriz para ese rol).
 */
async function decidirAutorizacion(autorizacionId, { decision, motivo }, ctx) {
  const { prisma, ejecutor } = ctx;
  if (!ejecutor?.id || !Array.isArray(ejecutor.roles)) {
    throw new ErrorAplicacion('EJECUTOR_AUSENTE', 500, 'Sesion sin roles identificables.');
  }
  if (!['AUTORIZADA', 'RECHAZADA'].includes(decision)) {
    throw new ErrorAplicacion('DATOS_INVALIDOS', 422, "Decision invalida: use 'AUTORIZADA' o 'RECHAZADA'.");
  }

  const solicitud = await prisma.autorizacionRol.findUnique({ where: { id: autorizacionId } });
  if (!solicitud) throw new ErrorAplicacion('NO_ENCONTRADO', 404, 'Autorizacion no encontrada.');
  const rol = await prisma.rol.findUnique({ where: { id: solicitud.rolId }, select: { codigo: true } });

  validarDecision({ ...solicitud, rolCodigo: rol?.codigo }, ejecutor.roles.map((r) => r.codigo ?? r), {
    autorizadaPorId: ejecutor.id,
  });

  const actualizada = await prisma.autorizacionRol.update({
    where: { id: autorizacionId },
    data: {
      estado: decision,
      autorizadaPorId: ejecutor.id,
      decididaEn: new Date(),
      motivo: motivo ?? solicitud.motivo,
    },
  });

  return { message: `Solicitud ${decision.toLowerCase()}.`, data: { id: actualizada.id, estado: actualizada.estado } };
}

async function listarAutorizaciones(ctx) {
  const filas = await ctx.prisma.autorizacionRol.findMany({
    orderBy: { id: 'desc' },
    take: 100,
    select: {
      id: true,
      estado: true,
      beneficiarioId: true,
      rolId: true,
      scopeDepartamentoId: true,
      solicitadaPorId: true,
      autorizadaPorId: true,
      motivo: true,
      creadaEn: true,
      decididaEn: true,
      venceEn: true,
      consumidaEn: true,
    },
  });
  // El modelo solo guarda IDs; se resuelven a nombres legibles para la UI.
  const [roles, usuarios, departamentos] = await Promise.all([
    ctx.prisma.rol.findMany({ select: { id: true, codigo: true, nombre: true } }),
    ctx.prisma.usuario.findMany({ select: { id: true, email: true } }),
    ctx.prisma.departamento.findMany({ select: { id: true, nombre: true } }),
  ]);
  const rolPorId = new Map(roles.map((r) => [r.id, r]));
  const usuarioPorId = new Map(usuarios.map((u) => [u.id, u]));
  const deptoPorId = new Map(departamentos.map((d) => [d.id, d]));
  return filas.map((f) => ({
    ...f,
    rol: rolPorId.get(f.rolId) || null,
    beneficiario: usuarioPorId.get(f.beneficiarioId) || null,
    autorizadaPor: f.autorizadaPorId ? usuarioPorId.get(f.autorizadaPorId) || null : null,
    departamento: f.scopeDepartamentoId ? deptoPorId.get(f.scopeDepartamentoId) || null : null,
  }));
}

async function cambiarEstado(usuarioId, estado, ctx) {
  const estadosValidos = ['ACTIVO', 'INACTIVO', 'BLOQUEADO'];
  if (!estadosValidos.includes(estado)) {
    throw new ErrorAplicacion('ESTADO_INVALIDO', 422, 'Estado no permitido.');
  }
  const usuario = await ctx.prisma.usuario.findUnique({ where: { id: usuarioId } });
  if (!usuario) throw new ErrorAplicacion('NO_ENCONTRADO', 404, 'Usuario no encontrado.');

  await ctx.prisma.usuario.update({
    where: { id: usuarioId },
    data: {
      estado,
      ...(estado === 'INACTIVO'
        ? {
            sesiones: {
              updateMany: { where: { revocadoEn: null }, data: { revocadoEn: new Date(), motivoRevoca: 'CUENTA_DESATIVADA' } },
            },
          }
        : {}),
    },
  });
  return { message: `Estado cambiado a ${estado}.` };
}

async function listarRoles(ctx) {
  return ctx.prisma.rol.findMany({
    include: { permisos: { include: { permiso: true } } },
    orderBy: { id: 'asc' },
  });
}

module.exports = {
  listarUsuarios,
  asignarRol,
  quitarRol,
  solicitarAutorizacion,
  decidirAutorizacion,
  listarAutorizaciones,
  cambiarEstado,
  listarRoles,
};
