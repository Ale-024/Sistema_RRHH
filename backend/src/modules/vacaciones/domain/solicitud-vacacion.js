const { ErrorDominio } = require('../../../shared/dominio/errores');

const TRANSICIONES = {
  SOLICITADO: ['EN_REVISION', 'CANCELADO'],
  EN_REVISION: ['APROBADO', 'RECHAZADO', 'SOLICITADO'],
  APROBADO: [],
  RECHAZADO: [],
  CANCELADO: [],
};

class SolicitudVacacion {
  constructor({ id, empleadoId, estado }) {
    this.id = id;
    this.empleadoId = empleadoId;
    this.estado = estado;
  }

  transicionar(destino) {
    if (!(TRANSICIONES[this.estado] ?? []).includes(destino)) {
      throw new ErrorDominio(
        'VACACION_TRANSICION_INVALIDA',
        `No se puede pasar de ${this.estado} a ${destino}.`
      );
    }
    return destino;
  }
}

module.exports = { SolicitudVacacion, TRANSICIONES };
