/**
 * Fabrica de middleware de validacion por esquemas Zod.
 * Los datos validados reemplazan a los originales en req.body y se
 * copian sobre req.params / req.query (objetos mutables).
 */
function validar(esquemas) {
  return (req, _res, next) => {
    try {
      if (esquemas.body) {
        req.body = esquemas.body.parse(req.body ?? {});
      }
      if (esquemas.params) {
        Object.assign(req.params, esquemas.params.parse(req.params));
      }
      if (esquemas.query) {
        Object.assign(req.query, esquemas.query.parse(req.query));
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = validar;
