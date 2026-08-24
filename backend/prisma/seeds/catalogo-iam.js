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
  ['solicitudes:crear', 'Crear solicitudes de permiso y vacaciones (CU03/CU04)'],
  ['solicitudes:revisar', 'Aprobar o rechazar solicitudes'],
  ['solicitudes:leer_global', 'Ver bandeja completa de solicitudes'],
  ['planilla:leer_global', 'Consultar nomina de todos los empleados (CU05)'],
  ['planilla:administrar', 'Crear, modificar y eliminar nominas'],
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
    permisos: ['asistencia:marcar', 'asistencia:leer_propia', 'solicitudes:crear'],
  },
  {
    codigo: 'ENCUESTADOR',
    nombre: 'Encuestador de campo',
    descripcion: 'Perfiles de campo; marcaje con geolocalizacion en fases posteriores.',
    permisos: ['asistencia:marcar', 'asistencia:leer_propia', 'solicitudes:crear'],
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
      'solicitudes:revisar',
      'solicitudes:leer_global',
      'planilla:leer_global',
    ],
  },
  {
    codigo: 'GERENTE_DEPTO',
    nombre: 'Gerente de departamento',
    descripcion: 'Visibilidad limitada a su departamento mediante scope ABAC.',
    permisos: ['empleados:leer', 'asistencia:leer_global', 'solicitudes:revisar'],
  },
  {
    codigo: 'DIRECCION',
    nombre: 'Direccion general',
    descripcion: 'Lectura global de planilla y auditoria; autorizacion de cierres.',
    permisos: ['planilla:leer_global', 'planilla:administrar', 'auditoria:leer'],
  },
  {
    codigo: 'ADMIN_TI',
    nombre: 'Administrador de TI',
    descripcion: 'Usuarios, roles y bitacora. Sin operaciones de negocio.',
    permisos: ['usuarios:administrar', 'organizacion:administrar', 'auditoria:leer'],
  },
];

module.exports = { PERMISOS, ROLES };
