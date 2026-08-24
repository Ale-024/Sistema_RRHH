export const ROLES_ADMINISTRATIVOS = ['ADMIN_TI', 'RRHH_SUP', 'DIRECCION'];

export const ETIQUETAS_ROL = {
  ADMIN_TI: 'Administrador de TI',
  RRHH_SUP: 'Supervisor de RRHH',
  DIRECCION: 'Dirección General',
  GERENTE_DEPTO: 'Gerente de Departamento',
  ENCUESTADOR: 'Encuestador',
  EMPLEADO: 'Empleado',
};

export function esRolAdministrativo(user) {
  return ROLES_ADMINISTRATIVOS.includes(user?.rol);
}

export function tienePermiso(user, codigo) {
  return Array.isArray(user?.permisos) && user.permisos.includes(codigo);
}
