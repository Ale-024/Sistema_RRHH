/**
 * Alcance departamental (plan, seccion 11.3).
 * Unico punto de paso obligado: toda consulta sobre datos de empleados
 * que carezca de permiso global debe invocar estas funciones.
 */

const PERMISO_LECTURA_GLOBAL = 'empleados:leer_global';

/**
 * Devuelve el filtro de departamento para la relacion puesto del empleado,
 * o null si el contexto tiene lectura global.
 */
function filtroDepartamento(contexto) {
  if (!contexto?.permisos?.has(PERMISO_LECTURA_GLOBAL)) {
    const alcances = contexto?.scopeDepartamentos ?? [];
    return {
      puesto: { departamento_id: { in: alcances.length ? alcances : [-1] } },
    };
  }
  return null;
}

/** Aplica el alcance a una consulta directa sobre Empleado. */
function aplicarAlcanceEmpleado(where, contexto) {
  const filtro = filtroDepartamento(contexto);
  return filtro ? { ...where, ...filtro } : where;
}

/**
 * Aplica el alcance a una consulta con relacion hacia Empleado
 * (asistencia, solicitudes, nomina): ruta = 'empleado'.
 */
function aplicarAlcanceRelacion(ruta, where, contexto) {
  if (!contexto?.permisos?.has(PERMISO_LECTURA_GLOBAL)) {
    const alcances = contexto?.scopeDepartamentos ?? [];
    return {
      ...where,
      [ruta]: {
        ...where?.[ruta],
        puesto: { departamento_id: { in: alcances.length ? alcances : [-1] } },
      },
    };
  }
  return where;
}

module.exports = { aplicarAlcanceEmpleado, aplicarAlcanceRelacion, filtroDepartamento };
