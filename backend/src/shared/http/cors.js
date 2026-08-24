const cors = require('cors');

function middlewareCors(entorno) {
  const { origenesPermitidos } = entorno;

  return cors({
    origin(origen, callback) {
      if (!origen || origenesPermitidos.includes(origen)) {
        return callback(null, true);
      }
      callback(new Error(`Origen no permitido: ${origen}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });
}

module.exports = middlewareCors;
