/**
 * Catalogo de permisos del sistema (modulo:accion).
 */
const PERMISOS = [
  ['empleados:leer', 'Consultar expedientes de empleados'],
  ['empleados:leer_global', 'Leer empleados de todos los departamentos sin alcance'],
  ['empleados:crear', 'Contratar empleados (CU01)'],
  ['empleados:actualizar', 'Modificar expediente y desactivar acceso'],
  ['empleados:desvincular', 'Registrar salida definitiva del empleado'],
  ['contratos:crear', 'Emitir contratos y renovaciones'],
  ['organizacion:administrar', 'Administrar departamentos y puestos'],
  ['asistencia:marcar', 'Registrar marcaje propio (CU02)'],
  ['asistencia:leer_propia', 'Consultar historial de asistencia propia'],
  ['asistencia:leer_global', 'Consultar asistencia global (con alcance segun rol)'],
  ['asistencia:importar', 'Importar marcajes por lote desde relojes o archivos'],
  ['asistencia:corregir', 'Corregir registros de asistencia con motivo'],
  ['asistencia:cerrar', 'Cerrar y reabrir dias de asistencia'],
  ['solicitudes:crear', 'Crear solicitudes de permiso y vacaciones (CU03/CU04)'],
  ['solicitudes:revisar', 'Aprobar o rechazar solicitudes'],
  ['solicitudes:leer_global', 'Ver bandeja completa de solicitudes'],
  ['permisos:aprobar', 'Aprobar, rechazar o devolver solicitudes de permiso'],
  ['vacaciones:leer', 'Consultar saldo y solicitudes propias de vacaciones'],
  ['vacaciones:leer_global', 'Consultar solicitudes de vacaciones del alcance autorizado'],
  ['vacaciones:crear', 'Crear y enviar solicitudes propias de vacaciones'],
  ['vacaciones:aprobar', 'Aprobar, rechazar o devolver vacaciones'],
  ['planilla:leer_global', 'Consultar nomina de todos los empleados (CU05)'],
  ['planilla:leer', 'Consultar periodos y recibos propios de planilla'],
  ['planilla:crear', 'Crear periodos y ajustes de planilla'],
  ['planilla:calcular', 'Calcular y enviar periodos de planilla a revision'],
  ['planilla:cerrar', 'Cerrar periodos de planilla y devolverlos a calculada'],
  ['planilla:registrar_pago', 'Registrar el pago de un periodo cerrado'],
  ['planilla:administrar', 'Crear, modificar y eliminar nominas'],
  ['parametros:leer', 'Consultar parametros legales versionados'],
  ['parametros:administrar', 'Administrar vigencias de parametros legales'],
  ['usuarios:administrar', 'Gestionar usuarios, roles y estados de cuenta'],
  ['auditoria:leer', 'Consultar la bitacora de auditoria'],
];

/**
 * Matriz rol -> permisos. La segregacion de funciones del plan se
 * conserva: ADMIN_TI no aprueba solicitudes ni administra planilla.
 */
const ROLES = [
  {
    codigo: 'EMPLEADO',
    nombre: 'Empleado',
    descripcion: 'Autoservicio: marcaje, solicitudes propias y perfil.',
    permisos: ['asistencia:marcar', 'asistencia:leer_propia', 'solicitudes:crear', 'vacaciones:leer', 'vacaciones:crear', 'planilla:leer'],
  },
  {
    codigo: 'ENCUESTADOR',
    nombre: 'Encuestador de campo',
    descripcion: 'Perfiles de campo; marcaje con geolocalizacion en fases posteriores.',
    permisos: ['asistencia:marcar', 'asistencia:leer_propia', 'solicitudes:crear', 'vacaciones:leer', 'vacaciones:crear', 'planilla:leer'],
  },
  {
    codigo: 'RRHH_SUP',
    nombre: 'Supervisor de RRHH',
    descripcion: 'Gestion completa de personal, catalogos y revision de solicitudes.',
    permisos: [
      'empleados:leer',
      'empleados:leer_global',
      'empleados:crear',
      'empleados:actualizar',
      'empleados:desvincular',
      'contratos:crear',
      'organizacion:administrar',
      'asistencia:leer_global',
      'asistencia:importar',
      'asistencia:corregir',
      'asistencia:cerrar',
      'solicitudes:revisar',
      'solicitudes:leer_global',
      'permisos:aprobar',
      'vacaciones:leer_global',
      'vacaciones:aprobar',
      'planilla:leer_global',
      'planilla:leer',
      'planilla:crear',
      'planilla:calcular',
      'planilla:administrar',
    ],
  },
  {
    codigo: 'GERENTE_DEPTO',
    nombre: 'Gerente de departamento',
    descripcion: 'Visibilidad limitada a su departamento mediante scope ABAC.',
    permisos: ['empleados:leer', 'asistencia:leer_global', 'solicitudes:revisar', 'permisos:aprobar', 'vacaciones:leer_global', 'vacaciones:aprobar'],
  },
  {
    codigo: 'DIRECCION',
    nombre: 'Direccion general',
    descripcion: 'Lectura global de planilla y auditoria; autorizacion de cierres.',
    permisos: ['planilla:leer_global', 'planilla:leer', 'planilla:cerrar', 'planilla:registrar_pago', 'parametros:leer', 'auditoria:leer'],
  },
  {
    codigo: 'ADMIN_TI',
    nombre: 'Administrador de TI',
    descripcion: 'Usuarios, roles y bitacora. Sin operaciones de negocio.',
    permisos: ['usuarios:administrar', 'organizacion:administrar', 'parametros:leer', 'parametros:administrar', 'auditoria:leer'],
  },
];

module.exports = { PERMISOS, ROLES };
