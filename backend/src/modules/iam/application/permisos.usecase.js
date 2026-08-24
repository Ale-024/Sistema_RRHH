/**
 * Resolucion de permisos efectivos y rol primario.
 */
function permisosDeUsuario(usuario) {
  const conjunto = new Set();
  for (const usuarioRol of usuario.roles ?? []) {
    for (const rolPermiso of usuarioRol.rol?.permisos ?? []) {
      conjunto.add(rolPermiso.permiso.codigo);
    }
  }
  return [...conjunto];
}

function rolPrimario(codigosRoles, prioridad) {
  for (const candidato of prioridad) {
    if (codigosRoles.includes(candidato)) return candidato;
  }
  return codigosRoles[0] ?? 'EMPLEADO';
}

module.exports = { permisosDeUsuario, rolPrimario };
