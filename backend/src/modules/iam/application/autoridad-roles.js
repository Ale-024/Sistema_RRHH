const { ErrorAplicacion } = require('../../../shared/dominio/errores');

/**
 * Anexo de autoridad para otorgar roles.
 *
 * Tres actos separados: alta de empleado (RRHH_SUP), alta de usuario
 * (ADMIN_TI) y asignacion de rol (ejecuta ADMIN_TI bajo la matriz de
 * otorgamiento y las invariantes 1-8).
 */

const NIVEL_ELEVADO_MINIMO = 30;

// Roles que exigen AutorizacionRol previa (Anexo sec. 3, matriz).
const ROLES_CON_AUTORIZACION = ['GERENTE_DEPTO', 'RRHH_SUP', 'ADMIN_TI', 'DIRECCION'];

// Quien puede SOLICITAR cada rol, segun la matriz.
const SOLICITANTE_POR_ROL = {
  EMPLEADO: ['RRHH_SUP'],
  ENCUESTADOR: ['RRHH_SUP'],
  GERENTE_DEPTO: ['RRHH_SUP'],
  RRHH_SUP: ['DIRECCION'],
  ADMIN_TI: ['ADMIN_TI'],
  DIRECCION: ['DIRECCION'],
};

// Quien puede AUTORIZAR cada rol elevado.
const AUTORIZADOR_POR_ROL = {
  GERENTE_DEPTO: ['DIRECCION'],
  RRHH_SUP: ['DIRECCION'],
  ADMIN_TI: ['DIRECCION'],
  DIRECCION: ['DIRECCION'],
};

// Vigencia por defecto de una autorizacion emitida (dias).
const VIGENCIA_AUTORIZACION_DIAS = 30;

function tieneAlgunRol(codigosUsuario, requeridos) {
  return codigosUsuario.some((c) => requeridos.includes(c));
}

/**
 * Matriz de otorgamiento: valida que el solicitante pueda pedir el rol.
 */
function validarSolicitud(rolesSolicitante, codigoRolObjetivo) {
  const permitidos = SOLICITANTE_POR_ROL[codigoRolObjetivo];
  if (!permitidos) {
    throw new ErrorAplicacion('ROL_INVALIDO', 422, 'El rol indicado no existe.');
  }
  if (!tieneAlgunRol(rolesSolicitante, permitidos)) {
    throw new ErrorAplicacion(
      'MATRIZ_SOLICITUD_DENEGADA',
      403,
      `Solo ${permitidos.join(' o ')} puede solicitar el rol ${codigoRolObjetivo}.`
    );
  }
}

/**
 * Decision sobre una solicitud (AUTORIZADA | RECHAZADA).
 * Invariante 4: el autorizador no puede ser el beneficiario; para el rol
 * DIRECCION tampoco puede ser el propio solicitante.
 * `solicitud` debe traer rolCodigo resuelto por el llamador.
 */
function validarDecision(solicitud, rolesDecisor, dobleControl) {
  if (solicitud.estado !== 'SOLICITADA') {
    throw new ErrorAplicacion('CONFLICTO_ESTADO', 409, 'La solicitud ya fue decidida.');
  }
  const autorizadores = AUTORIZADOR_POR_ROL[solicitud.rolCodigo] ?? [];
  if (!tieneAlgunRol(rolesDecisor, autorizadores)) {
    throw new ErrorAplicacion(
      'MATRIZ_DECISION_DENEGADA',
      403,
      `Solo ${autorizadores.join(' o ')} puede autorizar el rol ${solicitud.rolCodigo}.`
    );
  }
  if (dobleControl.autorizadaPorId === solicitud.beneficiarioId) {
    throw new ErrorAplicacion(
      'INV4_DOBLE_CONTROL',
      409,
      'El autorizador no puede ser el beneficiario del rol.'
    );
  }
  if (
    solicitud.rolCodigo === 'DIRECCION' &&
    dobleControl.autorizadaPorId === solicitud.solicitadaPorId
  ) {
    throw new ErrorAplicacion(
      'INV4_DOBLE_CONTROL',
      409,
      'Un Director no puede autorizarse su propio rol DIRECCION.'
    );
  }
}

/**
 * Ejecucion tecnica de la asignacion (la realiza ADMIN_TI).
 * Invariantes 1, 2, 3, 4 y 5 en dominio; los triggers SQL son ultima linea.
 */
async function validarEjecucion(prisma, { ejecutorId, beneficiarioId, rolCodigo, scopeDepartamentoId, autorizacionId }) {
  if (ejecutorId === beneficiarioId) {
    throw new ErrorAplicacion('INV1_AUTOASIGNACION', 409, 'Nadie puede otorgarse un rol a si mismo.');
  }

  const rol = await prisma.rol.findUnique({ where: { codigo: rolCodigo } });
  if (!rol) throw new ErrorAplicacion('ROL_INVALIDO', 422, 'El rol indicado no existe.');

  // Invariante 5: alcance obligatorio.
  if (rol.codigo === 'GERENTE_DEPTO' && !scopeDepartamentoId) {
    throw new ErrorAplicacion(
      'INV5_ALCANCE_INVALIDO',
      422,
      'GERENTE_DEPTO exige un departamento de alcance (scopeDepartamentoId).'
    );
  }
  if (rol.codigo !== 'GERENTE_DEPTO' && scopeDepartamentoId) {
    throw new ErrorAplicacion(
      'INV5_ALCANCE_INVALIDO',
      422,
      `El rol ${rol.codigo} no admite alcance departamental.`
    );
  }

  if (!ROLES_CON_AUTORIZACION.includes(rol.codigo)) {
    return { rol, autorizacion: null }; // niveles <= 10: sin autorizacion previa
  }

  // Invariantes 2/3/4: se exige autorizacion vigente y doble control.
  if (!autorizacionId) {
    throw new ErrorAplicacion(
      'INV3_SIN_AUTORIZACION_VIGENTE',
      409,
      `El rol ${rol.codigo} exige autorizacion previa de ${AUTORIZADOR_POR_ROL[rol.codigo].join(' o ')}.`
    );
  }

  const autorizacion = await prisma.autorizacionRol.findUnique({ where: { id: autorizacionId } });
  if (
    !autorizacion ||
    autorizacion.estado !== 'AUTORIZADA' ||
    autorizacion.consumidaEn ||
    autorizacion.beneficiarioId !== beneficiarioId ||
    autorizacion.rolId !== rol.id ||
    (autorizacion.venceEn && autorizacion.venceEn <= new Date())
  ) {
    throw new ErrorAplicacion(
      'INV3_SIN_AUTORIZACION_VIGENTE',
      409,
      'La autorizacion no existe, esta vencida, consumida o no corresponde a este rol/beneficiario.'
    );
  }

  if (autorizacion.autorizadaPorId === ejecutorId) {
    throw new ErrorAplicacion(
      'INV4_DOBLE_CONTROL',
      409,
      'Quien autorizo no puede ejecutar la asignacion.'
    );
  }
  if (autorizacion.autorizadaPorId === beneficiarioId) {
    throw new ErrorAplicacion('INV4_DOBLE_CONTROL', 409, 'El beneficiario no puede autoautorizarse.');
  }

  return { rol, autorizacion };
}

/**
 * Revocacion: invariantes 1 y 7 (continuidad administrativa).
 */
async function validarRevocacion(prisma, { ejecutorId, beneficiarioId, rolId }) {
  if (ejecutorId === beneficiarioId) {
    throw new ErrorAplicacion('INV1_AUTOASIGNACION', 409, 'Nadie puede revocarse un rol a si mismo.');
  }

  const rol = await prisma.rol.findUnique({ where: { id: rolId } });
  if (rol && ['ADMIN_TI', 'DIRECCION'].includes(rol.codigo)) {
    const otrosActivos = await prisma.usuarioRol.count({
      where: {
        rolId,
        usuarioId: { not: beneficiarioId },
        usuario: { estado: 'ACTIVO' },
      },
    });
    if (otrosActivos === 0) {
      throw new ErrorAplicacion(
        'INV7_ULTIMO_ADMINISTRADOR',
        409,
        `No puede retirarse el ultimo ${rol.codigo} activo del sistema.`
      );
    }
  }
  return rol;
}

module.exports = {
  NIVEL_ELEVADO_MINIMO,
  ROLES_CON_AUTORIZACION,
  SOLICITANTE_POR_ROL,
  AUTORIZADOR_POR_ROL,
  VIGENCIA_AUTORIZACION_DIAS,
  validarSolicitud,
  validarDecision,
  validarEjecucion,
  validarRevocacion,
};
