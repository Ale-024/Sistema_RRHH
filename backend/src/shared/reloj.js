/**
 * Reloj inyectable. Permite congelar el tiempo en pruebas.
 */
const reloj = {
  ahora: () => new Date(),
};

module.exports = reloj;
