/**
 * Reglas de arquitectura verificadas en integracion continua.
 * Direcciones de dependencia del plan (seccion 4.2 del documento).
 */
module.exports = {
  forbidden: [
    {
      name: 'dominio-sin-infraestructura',
      comment:
        'domain/ no importa Prisma, Express ni configuracion de entorno.',
      severity: 'error',
      from: { path: 'src/modules/[^/]+/domain' },
      to: {
        path: ['(@prisma|express|dotenv)', 'src/db', 'src/config'],
        pathNot: 'node_modules/.+',
      },
    },
    {
      name: 'sin-importar-infrastructure-ajena',
      comment: 'Un modulo nunca importa infraestructura de otro modulo.',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/' },
      to: { path: '^src/modules/(?!\\1)[^/]+/infrastructure' },
    },
    {
      name: 'application-sin-prisma-directo-en-dominio',
      severity: 'warn',
      from: { path: '^src/shared/dominio' },
      to: { path: '@prisma' },
    },
  ],
};
