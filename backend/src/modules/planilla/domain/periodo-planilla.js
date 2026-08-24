const { ErrorDominio } = require('../../../shared/dominio/errores');

const TRANSICIONES = {
  BORRADOR: ['CALCULADA'],
  CALCULADA: ['EN_APROBACION'],
  EN_APROBACION: ['CALCULADA', 'CERRADA'],
  CERRADA: ['PAGADA'],
  PAGADA: [],
};

class PeriodoPlanilla {
  constructor({ id, estado, codigo }) {
    this.id = id;
    this.codigo = codigo;
    this.estado = estado;
  }

  transicionar(destino) {
    if (!(TRANSICIONES[this.estado] ?? []).includes(destino)) {
      throw new ErrorDominio('PLANILLA_TRANSICION_INVALIDA', `No se puede pasar de ${this.estado} a ${destino}.`);
    }
    return destino;
  }
}

module.exports = { PeriodoPlanilla, TRANSICIONES };
