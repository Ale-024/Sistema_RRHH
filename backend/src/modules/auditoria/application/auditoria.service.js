/**
 * Registro de auditoria. Toda operacion sensible debe dejar rastro aqui
 * (plan, seccion 11: bitacora append-only, retencion minima 5 anos).
 * Los campos sensibles nunca se registran en claro.
 */
async function registrar(prisma, datos) {
  try {
    await prisma.auditoria.create({
      data: {
        usuarioId: datos.usuarioId ?? null,
        entidad: datos.entidad,
        entidadId: datos.entidadId ?? null,
        accion: datos.accion,
        antes: datos.antes ? JSON.stringify(datos.antes) : null,
        despues: datos.despues ? JSON.stringify(datos.despues) : null,
        ip: datos.ip ?? null,
        userAgent: datos.userAgent ?? null,
        requestId: datos.requestId ?? null,
      },
    });
  } catch (error) {
    // La auditoria jamas debe interrumpir el comando de negocio,
    // pero su fallo se hace visible en el registro.
    console.error('[auditoria] Fallo al registrar:', error.message);
  }
}

/**
 * Suscriptores de eventos de dominio que materializan la bitacora.
 */
function registrarSuscriptores(bus, prisma) {
  const auditar = (entidad, accion) => async (evento) => {
    await registrar(prisma, {
      usuarioId: evento.usuarioId ?? null,
      entidad,
      entidadId: evento[`${entidad.toLowerCase()}Id`] ?? evento.id ?? null,
      accion,
      despues: { ...evento },
    });
  };

  bus.suscribir('EmpleadoContratado', auditar('Empleado', 'CREAR'));
  bus.suscribir('EmpleadoDesactivado', auditar('Empleado', 'DESACTIVAR'));
  bus.suscribir('EmpleadoDesvinculado', auditar('Empleado', 'DESVINCULAR'));
  bus.suscribir('PasswordCambiada', auditar('Usuario', 'CAMBIAR_PASSWORD'));
  bus.suscribir('SesionIniciada', () => {}); // el login ya audita directamente
  bus.suscribir('MarcajeRegistrado', auditar('Asistencia', 'MARCAR'));
  bus.suscribir('SolicitudCreada', auditar('Solicitud', 'CREAR'));
  const auditarPermiso = (accion) => async (evento) => {
    await registrar(prisma, {
      usuarioId: evento.usuarioId ?? null,
      entidad: 'SolicitudPermiso',
      entidadId: evento.permisoId,
      accion,
      despues: { ...evento },
    });
  };
  bus.suscribir('PermisoSolicitado', auditarPermiso('CREAR'));
  bus.suscribir('PermisoEnviadoRevision', auditarPermiso('ENVIAR_REVISION'));
  bus.suscribir('PermisoAprobado', auditarPermiso('APROBAR'));
  bus.suscribir('PermisoRechazado', auditarPermiso('RECHAZAR'));
  bus.suscribir('PermisoCorreccionSolicitada', auditarPermiso('SOLICITAR_CORRECCION'));
  bus.suscribir('PermisoCancelado', auditarPermiso('CANCELAR'));
}

module.exports = { registrar, registrarSuscriptores };
