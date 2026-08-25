const bcrypt = require('bcryptjs');
const { ErrorAplicacion } = require('../../../shared/dominio/errores');
const { aplicarAlcanceEmpleado } = require('../../../shared/dominio/alcance');
const auditoria = require('../../auditoria/application/auditoria.service');
const { COSTE_BCRYPT } = require('../../iam/application/cambiar-password.usecase');

const aCentavos = (monto) => Math.round(monto * 100);

/**
 * Proyeccion publica del empleado: descifra los campos sensibles para
 * presentacion autorizada y nunca expone hashes ni datos cifrados crudos.
 */
function empleadoPublico(empleado, cifrador) {
  if (!empleado) return null;
  const { numero_ihss_cif, numero_rap_cif, cuenta_bancaria_cif, ...resto } = empleado;
  return {
    ...resto,
    numero_ihss: cifrador.descifrar(numero_ihss_cif),
    numero_rap: cifrador.descifrar(numero_rap_cif),
    cuenta_bancaria: cifrador.descifrar(cuenta_bancaria_cif),
  };
}

const INCLUIR_EXPEDIENTE = {
    usuario: { select: { id: true, email: true, estado: true, roles: { select: { rol: { select: { codigo: true } } } } } },
    puesto: { include: { departamento: true } },
    // Contrato vigente: fuente del salario actual (versionado por contrato).
    contratos: {
      where: { vigenciaHasta: null },
      select: { salarioBaseCent: true, periodicidad: true, modalidad: true, vigenciaDesde: true },
      take: 1,
      orderBy: { vigenciaDesde: 'desc' },
    },
  };

async function listarEmpleados(contextoAutorizacion, ctx) {
  const where = aplicarAlcanceEmpleado({}, contextoAutorizacion);
  return ctx.prisma.empleado.findMany({
    where,
    include: INCLUIR_EXPEDIENTE,
    orderBy: [{ apellidos: 'asc' }, { nombres: 'asc' }],
  });
}

async function obtenerPerfil(empleadoId, ctx) {
  const empleado = await ctx.prisma.empleado.findUnique({
    where: { id: empleadoId },
    include: { puesto: { include: { departamento: true } } },
  });
  if (!empleado) {
    throw new ErrorAplicacion('NO_ENCONTRADO', 404, 'Empleado no encontrado.');
  }
  return empleadoPublico(empleado, ctx.cifrador);
}

/**
 * CU01 - Contratacion. Crea usuario + empleado + contrato inicial e
 * historial en una sola transaccion. La contrasena inicial NO viaja en
 * la notificacion; RRHH la comunica por canal seguro.
 */
async function crearEmpleado(datos, ctx) {
  const { prisma, bus, cifrador } = ctx;
  const hashedPassword = await bcrypt.hash(datos.password, COSTE_BCRYPT);

  const resultado = await prisma.$transaction(async (tx) => {
    const usuario = await tx.usuario.create({
      data: {
        email: datos.email,
        password_hash: hashedPassword,
        estado: 'ACTIVO',
        debeCambiarPassword: true,
      },
    });

    const empleado = await tx.empleado.create({
      data: {
        usuario_id: usuario.id,
        puesto_id: datos.puesto_id,
        nombres: datos.nombres,
        apellidos: datos.apellidos,
        dni: datos.dni,
        dni_hmac: cifrador.hmac(datos.dni),
        fecha_ingreso: datos.fecha_ingreso,
        telefono: datos.telefono,
        direccion: datos.direccion,
        rtn: datos.rtn,
        fecha_nacimiento: datos.fecha_nacimiento,
        sexo: datos.sexo,
        estadoLaboral: 'ACTIVO',
      },
    });

    await tx.contrato.create({
      data: {
        empleado_id: empleado.id,
        modalidad: datos.modalidad,
        salarioBaseCent: aCentavos(datos.salario),
        periodicidad: datos.periodicidad,
        aplicaIhss: datos.aplica_ihss,
        aplicaRap: datos.aplica_rap,
        vigenciaDesde: datos.fecha_ingreso,
      },
    });

    await tx.historialLaboral.create({
      data: {
        empleado_id: empleado.id,
        tipo: 'CONTRATACION',
        valorNuevo: JSON.stringify({ puesto_id: datos.puesto_id, modalidad: datos.modalidad }),
        motivo: 'Contratacion inicial',
      },
    });

    // Anexo de autoridad (sec. 3.1): el alta laboral confiere solo el rol
    // base EMPLEADO. Si el puesto sugiere ENCUESTADOR (nivel 10) se agrega;
    // los roles elevados exigen su propio flujo de autorizacion.
    const puesto = await tx.puesto.findUnique({ where: { id: datos.puesto_id } });
    const rolBase = await tx.rol.findUnique({ where: { codigo: 'EMPLEADO' } });
    if (rolBase) {
      await tx.usuarioRol.create({ data: { usuarioId: usuario.id, rolId: rolBase.id } });
    }
    if (puesto?.rolSugerido && puesto.rolSugerido !== 'EMPLEADO') {
      const rolSugerido = await tx.rol.findUnique({ where: { codigo: puesto.rolSugerido } });
      if (rolSugerido && rolSugerido.nivelAutoridad <= 10) {
        await tx.usuarioRol.create({ data: { usuarioId: usuario.id, rolId: rolSugerido.id } });
      }
    }

    await tx.notificacion.create({
      data: {
        empleado_id: empleado.id,
        mensaje: `Bienvenido/a ${datos.nombres} ${datos.apellidos}. Su cuenta ha sido creada. Solicite su contrasena temporal al area de RRHH y cambielas en el primer ingreso.`,
      },
    });

    return { usuario, empleado };
  });

  bus.publicar('EmpleadoContratado', {
    empleadoId: resultado.empleado.id,
    usuarioId: resultado.usuario.id,
  });
  return resultado;
}

async function actualizarEmpleado(id, datos, contextoAutorizacion, ctx) {
  const { prisma, cifrador } = ctx;
  const anterior = await prisma.empleado.findUnique({ where: { id } });
  if (!anterior) throw new ErrorAplicacion('NO_ENCONTRADO', 404, 'Empleado no encontrado.');

  const { activo, ...datosEmpleado } = datos;
  const empleado = await prisma.empleado.update({ where: { id }, data: datosEmpleado });

  if (datos.puesto_id && datos.puesto_id !== anterior.puesto_id) {
    await prisma.historialLaboral.create({
      data: {
        empleado_id: id,
        tipo: 'CAMBIO_PUESTO',
        valorAnterior: JSON.stringify({ puesto_id: anterior.puesto_id }),
        valorNuevo: JSON.stringify({ puesto_id: datos.puesto_id }),
      },
    });
  }

  if (activo !== undefined) {
    await prisma.usuario.update({
      where: { id: empleado.usuario_id },
      data: { estado: activo ? 'ACTIVO' : 'INACTIVO' },
    });
    await prisma.empleado.update({
      where: { id },
      data: { estadoLaboral: activo ? 'ACTIVO' : 'INACTIVO' },
    });
  }

  await auditoria.registrar(prisma, {
    usuarioId: contextoAutorizacion?.usuarioId,
    entidad: 'Empleado',
    entidadId: id,
    accion: 'ACTUALIZAR',
    antes: { nombres: anterior.nombres, apellidos: anterior.apellidos, puesto_id: anterior.puesto_id },
    despues: datos,
    ip: contextoAutorizacion?.ip,
    requestId: contextoAutorizacion?.requestId,
  });

  return empleadoPublico(await prisma.empleado.findUnique({
    where: { id },
    include: INCLUIR_EXPEDIENTE,
  }), cifrador);
}

/** Baja logica conservada del MVP: desactiva acceso y marca estado. */
async function desactivarEmpleado(id, contextoAutorizacion, ctx) {
  const { prisma } = ctx;
  const empleado = await prisma.empleado.findUnique({ where: { id } });
  if (!empleado) throw new ErrorAplicacion('NO_ENCONTRADO', 404, 'Empleado no encontrado.');

  await prisma.$transaction([
    prisma.usuario.update({
      where: { id: empleado.usuario_id },
      data: { estado: 'INACTIVO' },
    }),
    prisma.sesionRefresh.updateMany({
      where: { usuarioId: empleado.usuario_id, revocadoEn: null },
      data: { revocadoEn: new Date(), motivoRevoca: 'CUENTA_DESATIVADA' },
    }),
    prisma.empleado.update({
      where: { id },
      data: { estadoLaboral: 'INACTIVO' },
    }),
  ]);

  await auditoria.registrar(prisma, {
    usuarioId: contextoAutorizacion?.usuarioId,
    entidad: 'Empleado',
    entidadId: id,
    accion: 'DESACTIVAR',
    ip: contextoAutorizacion?.ip,
    requestId: contextoAutorizacion?.requestId,
  });

  return { message: 'Empleado desactivado (Baja logica)' };
}

/** Salida definitiva con causa registrada (CU01). */
async function desvincularEmpleado(id, { causa, motivo, fecha }, contextoAutorizacion, ctx) {
  const { prisma } = ctx;
  const empleado = await prisma.empleado.findUnique({ where: { id } });
  if (!empleado) throw new ErrorAplicacion('NO_ENCONTRADO', 404, 'Empleado no encontrado.');
  if (empleado.estadoLaboral === 'INACTIVO') {
    throw new ErrorAplicacion(
      'YA_INACTIVO',
      409,
      'El empleado ya se encuentra inactivo.'
    );
  }

  await prisma.$transaction([
    prisma.empleado.update({
      where: { id },
      data: {
        estadoLaboral: 'INACTIVO',
        causaSalida: `${causa}: ${motivo}`,
        // Cierra el contrato vigente a la fecha de salida.
      },
    }),
    prisma.contrato.updateMany({
      where: { empleado_id: id, vigenciaHasta: null },
      data: { vigenciaHasta: fecha },
    }),
    prisma.usuario.update({
      where: { id: empleado.usuario_id },
      data: { estado: 'INACTIVO' },
    }),
    prisma.sesionRefresh.updateMany({
      where: { usuarioId: empleado.usuario_id, revocadoEn: null },
      data: { revocadoEn: fecha, motivoRevoca: 'DESVINCULACION' },
    }),
    prisma.historialLaboral.create({
      data: {
        empleado_id: id,
        tipo: 'CAMBIO_ESTADO',
        valorAnterior: JSON.stringify({ estadoLaboral: empleado.estadoLaboral }),
        valorNuevo: JSON.stringify({ estadoLaboral: 'INACTIVO', causa, fecha }),
        motivo,
        autorizadoPor: contextoAutorizacion?.usuarioId,
      },
    }),
  ]);

  ctx.bus.publicar('EmpleadoDesvinculado', {
    empleadoId: id,
    causa,
    usuarioId: contextoAutorizacion?.usuarioId,
  });

  await auditoria.registrar(prisma, {
    usuarioId: contextoAutorizacion?.usuarioId ?? null,
    entidad: 'Empleado',
    entidadId: id,
    accion: 'DESVINCULAR',
    despues: { causa, motivo, fecha },
    ip: contextoAutorizacion?.ip,
    requestId: contextoAutorizacion?.requestId,
  });

  return { message: 'Empleado desvinculado.' };
}

/**
 * Nuevo contrato o renovacion. Cierra el contrato vigente el dia anterior
 * a la nueva vigencia; el indice parcial unico impide dos vigentes.
 */
async function crearContrato(id, datos, contextoAutorizacion, ctx) {
  const { prisma } = ctx;
  const empleado = await prisma.empleado.findUnique({ where: { id } });
  if (!empleado) throw new ErrorAplicacion('NO_ENCONTRADO', 404, 'Empleado no encontrado.');
  if (empleado.estadoLaboral === 'INACTIVO') {
    throw new ErrorAplicacion(
      'EMPLEADO_INACTIVO',
      409,
      'No se pueden emitir contratos a un empleado inactivo.'
    );
  }

  const desde = new Date(datos.vigenciaDesde);
  const cierreAnterior = new Date(desde);
  cierreAnterior.setDate(cierreAnterior.getDate() - 1);

  const contrato = await prisma.$transaction(async (tx) => {
    const anteriorVigente = await tx.contrato.findFirst({
      where: { empleado_id: id, vigenciaHasta: null },
    });

    let salarioAnterior;
    if (anteriorVigente) {
      await tx.contrato.update({
        where: { id: anteriorVigente.id },
        data: { vigenciaHasta: cierreAnterior },
      });
      salarioAnterior = anteriorVigente.salarioBaseCent;
    }

    const nuevo = await tx.contrato.create({
      data: {
        empleado_id: id,
        modalidad: datos.modalidad,
        salarioBaseCent: aCentavos(datos.salario),
        periodicidad: datos.periodicidad,
        aplicaIhss: datos.aplica_ihss,
        aplicaRap: datos.aplica_rap,
        vigenciaDesde: desde,
      },
    });

    await tx.historialLaboral.create({
      data: {
        empleado_id: id,
        tipo: salarioAnterior !== undefined && salarioAnterior !== nuevo.salarioBaseCent
          ? 'AJUSTE_SALARIO'
          : 'CAMBIO_ESTADO',
        valorAnterior: salarioAnterior !== undefined ? JSON.stringify({ salarioBaseCent: salarioAnterior }) : null,
        valorNuevo: JSON.stringify({ contratoId: nuevo.id, salarioBaseCent: nuevo.salarioBaseCent }),
        motivo: datos.modalidad === 'PERMANENTE' ? 'Renovacion o ajuste de contrato' : `Contrato ${datos.modalidad}`,
        autorizadoPor: contextoAutorizacion?.usuarioId,
      },
    });

    return nuevo;
  });

  await auditoria.registrar(prisma, {
    usuarioId: contextoAutorizacion?.usuarioId ?? null,
    entidad: 'Contrato',
    entidadId: contrato.id,
    accion: 'CREAR',
    despues: { ...contrato },
    ip: contextoAutorizacion?.ip,
    requestId: contextoAutorizacion?.requestId,
  });

  return contrato;
}

module.exports = {
  empleadoPublico,
  listarEmpleados,
  obtenerPerfil,
  crearEmpleado,
  actualizarEmpleado,
  desactivarEmpleado,
  desvincularEmpleado,
  crearContrato,
};
