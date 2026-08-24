class ErrorDominio extends Error {
  constructor(codigo, mensaje) {
    super(mensaje);
    this.name = 'ErrorDominio';
    this.codigo = codigo;
  }
}

class ErrorAplicacion extends Error {
  constructor(codigo, estadoHttp, mensaje) {
    super(mensaje);
    this.name = 'ErrorAplicacion';
    this.codigo = codigo;
    this.estadoHttp = estadoHttp;
  }
}

module.exports = { ErrorDominio, ErrorAplicacion };
