const { ErrorDominio } = require('../../../shared/dominio/errores');

const TRANSICIONES = Object.freeze({
  SOLICITADO: ['EN_REVISION', 'CANCELADO'],
  EN_REVISION: ['APROBADO', 'RECHAZADO', 'SOLICITADO'],
  APROBADO: [],
  RECHAZADO: [],
  CANCELADO: [],
});

class SolicitudPermiso {
  constructor({ id, estado, empleadoId }) {
    this.id = id;
    this.estado = estado;
    this.empleadoId = empleadoId;
  }

  #assertTransicion(destino) {
    if (!TRANSICIONES[this.estado]?.includes(destino)) {
      throw new ErrorDominio(
        'TRANSICION_INVALIDA',
        `No se permite pasar de ${this.estado} a ${destino}.`
      );
    }
  }

  transicionar(destino) {
    this.#assertTransicion(destino);
    const anterior = this.estado;
    this.estado = destino;
    return { anterior, nuevo: destino };
  }
}

module.exports = { SolicitudPermiso, TRANSICIONES };
