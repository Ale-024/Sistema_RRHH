/**
 * Fabrica de middleware de validacion por esquemas Zod.
 * Los datos validados reemplazan a los originales. En Express 5
 * `req.query` es un getter que reparsifica en cada acceso, por lo que
 * el resultado se sombra como propiedad propia del objeto request.
 */
function sombrear(req, clave, valor) {
  // En Express 5 algunas propiedades del request son getters de prototipo;
  // en modo no-estricto la asignacion directa se descarta SIN error, asi
  // que se sombra siempre como propiedad propia del request.
  const propia = Object.getOwnPropertyDescriptor(req, clave);
  if (propia && propia.configurable === false) {
    req[clave] = valor;
    return;
  }
  Object.defineProperty(req, clave, {
    value: valor,
    writable: true,
    configurable: true,
    enumerable: true,
  });
}

function validar(esquemas) {
  return (req, _res, next) => {
    try {
      if (esquemas.body) {
        const __p = esquemas.body.parse(req.body ?? {});
        sombrear(req, 'body', __p);
      }
      if (esquemas.params) {
        sombrear(req, 'params', esquemas.params.parse(req.params ?? {}));
      }
      if (esquemas.query) {
        const parsed = esquemas.query.parse(req.query ?? {});
        sombrear(req, 'query', { ...Object.create(null), ...parsed });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = validar;
