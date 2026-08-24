const { devengarVacaciones } = require('../modules/vacaciones/application/vacaciones.usecase');

async function devengarHoy(ctx, fecha = new Date()) {
  return devengarVacaciones({ prisma: ctx.prisma, fecha });
}

module.exports = { devengarHoy };
