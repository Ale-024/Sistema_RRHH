const BASE_TIPO_ERROR = 'https://sirh.marketingtotal.hn/errors';

function mapear(err) {
  if (err.name === 'ZodError') {
    return {
      status: 422,
      type: `${BASE_TIPO_ERROR}/validacion`,
      title: 'Datos de entrada invalidos',
      detail: 'La solicitud no cumple el formato esperado.',
      errores: err.issues.map((i) => ({
        campo: i.path.join('.'),
        mensaje: i.message,
      })),
    };
  }

  if (err.name === 'ErrorAplicacion' || err.name === 'ErrorDominio') {
    return {
      status: err.estadoHttp ?? 409,
      type: `${BASE_TIPO_ERROR}/${String(err.codigo).toLowerCase().replace(/_/g, '-')}`,
      title: tituloPorCodigo(err.codigo),
      detail: err.message,
    };
  }

  if (err.code === 'P2025') {
    return {
      status: 404,
      type: `${BASE_TIPO_ERROR}/no-encontrado`,
      title: 'Recurso no encontrado',
      detail: 'El recurso solicitado no existe.',
    };
  }

  const dominioSql = ['SALDO_VACACIONES_INSUFICIENTE', 'SALDO_VACACIONES_EXCEDIDO', 'VACACION_SOLAPADA', 'VACACION_TRANSICION_INVALIDA', 'VACACION_RANGO_INVALIDO', 'PLANILLA_CERRADA_INMUTABLE', 'DETALLE_PLANILLA_INMUTABLE', 'LINEA_PLANILLA_INMUTABLE', 'DESCUADRE_DETALLE_PLANILLA', 'PLANILLA_TRANSICION_INVALIDA'];
  const codigoSql = dominioSql.find((codigo) => String(err.message ?? '').includes(codigo));
  if (codigoSql) {
    return {
      status: 409,
      type: `${BASE_TIPO_ERROR}/${codigoSql.toLowerCase().replace(/_/g, '-')}`,
      title: tituloPorCodigo(codigoSql),
      detail: 'La operacion viola una regla de integridad de vacaciones.',
    };
  }

  return {
    status: 500,
    type: `${BASE_TIPO_ERROR}/interno`,
    title: 'Error interno',
    detail: 'Ocurrio un error inesperado. Intente nuevamente mas tarde.',
  };
}

function tituloPorCodigo(codigo) {
  const titulos = {
    CREDENCIALES_INVALIDAS: 'Credenciales invalidas',
    CUENTA_DESATIVADA: 'Cuenta desactivada',
    TRANSICION_INVALIDA: 'Transicion de estado invalida',
    DATOS_INVALIDOS: 'Datos invalidos',
    PERMISO_DENEGADO: 'Permiso denegado',
    NO_ENCONTRADO: 'Recurso no encontrado',
    CONFLICTO_ESTADO: 'Conflicto con el estado actual',
    SALDO_VACACIONES_INSUFICIENTE: 'Saldo vacacional insuficiente',
    SALDO_VACACIONES_EXCEDIDO: 'Saldo vacacional excedido',
    VACACION_SOLAPADA: 'Solicitud vacacional solapada',
    VACACION_TRANSICION_INVALIDA: 'Transicion de vacaciones invalida',
    PLANILLA_CERRADA_INMUTABLE: 'Planilla cerrada inmutable',
    DETALLE_PLANILLA_INMUTABLE: 'Detalle de planilla inmutable',
    LINEA_PLANILLA_INMUTABLE: 'Linea de planilla inmutable',
    DESCUADRE_DETALLE_PLANILLA: 'Descuadre de planilla',
    PLANILLA_TRANSICION_INVALIDA: 'Transicion de planilla invalida',
    MFA_REQUERIDO: 'Segundo factor requerido',
    MFA_INVALIDO: 'Codigo MFA invalido',
    MFA_NO_APLICA: 'MFA no aplica a este perfil',
  };
  return titulos[codigo] ?? 'Solicitud rechazada';
}

function manejadorErrores(err, req, res, _next) {
  const problema = mapear(err);
  if (problema.status >= 400 && req.app?.locals?.metrics) req.app.locals.metrics.errores += 1;
  if (problema.status >= 500) {
    console.error('[error]', { requestId: req.contexto?.requestId, err });
  }
  res.status(problema.status).type('application/problem+json').json({
    ...problema,
    // Alias de compatibilidad mientras el frontend migra a `detail`.
    message: problema.detail,
    instance: req.originalUrl,
    requestId: req.contexto?.requestId,
  });
}

module.exports = manejadorErrores;
