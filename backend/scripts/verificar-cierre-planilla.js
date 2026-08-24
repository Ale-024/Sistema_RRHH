require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const { hashPeriodo } = require('../src/modules/planilla/application/planilla.usecase');

const prisma = new PrismaClient();

async function main() {
  const argumento = process.argv.find((item) => item.startsWith('--periodo='));
  const id = argumento ? Number(argumento.split('=')[1]) : null;
  const periodos = await prisma.periodoPlanilla.findMany({
    where: { ...(id ? { id } : {}), estado: { in: ['CERRADA', 'PAGADA'] } },
    include: { detalles: { include: { lineas: true } } },
    orderBy: { id: 'asc' },
  });
  if (!periodos.length) throw new Error('No hay periodos cerrados para verificar.');
  let errores = 0;
  for (const periodo of periodos) {
    if (!periodo.hashCierre) {
      console.log(`${periodo.codigo}: LEGACY_SIN_HASH`);
      continue;
    }
    const calculado = hashPeriodo(periodo);
    const valido = calculado === periodo.hashCierre;
    console.log(`${periodo.codigo}: ${valido ? 'OK' : 'INVALIDO'}`);
    if (!valido) errores += 1;
  }
  if (errores) throw new Error(`${errores} periodos tienen un hash invalido.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
