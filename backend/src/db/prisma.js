const { PrismaClient } = require('@prisma/client');

/**
 * Crea el cliente Prisma y aplica los PRAGMA obligatorios de SQLite.
 * Sin `foreign_keys = ON`, SQLite ignora las claves foraneas declaradas.
 */
async function crearClientePrisma() {
  const prisma = new PrismaClient();
  await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL;');
  await prisma.$queryRawUnsafe('PRAGMA foreign_keys = ON;');
  await prisma.$queryRawUnsafe('PRAGMA busy_timeout = 5000;');
  await prisma.$queryRawUnsafe('PRAGMA synchronous = NORMAL;');
  return prisma;
}

async function verificarPragmas(prisma) {
  const fk = await prisma.$queryRawUnsafe('PRAGMA foreign_keys;');
  const wal = await prisma.$queryRawUnsafe('PRAGMA journal_mode;');
  return { foreignKeys: fk[0]?.foreign_keys === 1, journalMode: wal[0]?.journal_mode };
}

module.exports = { crearClientePrisma, verificarPragmas };
