const { EventEmitter } = require('node:events');

/**
 * Bus de eventos de dominio en proceso.
 * Los suscriptores fallidos se registran y no afectan al comando que publica.
 */
class BusEventos extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
  }

  suscribir(nombre, manejador) {
    this.on(nombre, async (evento) => {
      try {
        await manejador(evento);
      } catch (error) {
        console.error(`[bus] Suscriptor de "${nombre}" fallo:`, error.message);
      }
    });
  }

  publicar(nombre, carga) {
    setImmediate(() => {
      this.emit(nombre, { ...carga, ocurridoEn: new Date() });
    });
  }
}

module.exports = BusEventos;
