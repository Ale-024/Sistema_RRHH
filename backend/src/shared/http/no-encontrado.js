const { ErrorAplicacion } = require('../dominio/errores');

function noEncontrado(req, _res, next) {
  next(
    new ErrorAplicacion(
      'RUTA_NO_ENCONTRADA',
      404,
      `La ruta ${req.method} ${req.originalUrl} no existe.`
    )
  );
}

module.exports = noEncontrado;
