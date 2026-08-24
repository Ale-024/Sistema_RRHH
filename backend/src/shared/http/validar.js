/**
 * Fabrica de middleware de validacion por esquemas Zod.
 * Los datos validados reemplazan a los originales. En Express 5
 * `req.query` es un getter que reparsifica en cada acceso, por lo que
 * el resultado se sombra como propiedad propia del objeto request.
 */
function validar(esquemas) {
  return (req, _res, next) => {
    try {
      if (esquemas.body) {
        req.body = esquemas.body.parse(req.body ?? {});
      }
      if (esquemas.params) {
        req.params = esquemas.params.parse(req.params ?? {});
      }
      if (esquemas.query) {
        const parsed = esquemas.query.parse(req.query ?? {});
        Object.defineProperty(req, 'query', {
          value: { ...Object.create(null), ...parsed },
          writable: true,
          configurable: true,
          enumerable: true,
        });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = validar;
