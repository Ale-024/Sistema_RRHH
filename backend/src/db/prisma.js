const { PrismaClient } = require('@prisma/client');

/**
 * Proveedor de base de datos detectado de DATABASE_URL. El proyecto corre
 * en PostgreSQL (Neon) en produccion; SQLite queda solo como legado de
 * desarrollo. Los PRAGMA son exclusivos de SQLite y deben omitirse en PG.
 */
function esProveedorPostgres(url = process.env.DATABASE_URL) {
  return /^postgres(ql)?:\/\//.test(url ?? '');
}

const esPostgres = esProveedorPostgres();

/**
 * Crea el cliente Prisma. En SQLite aplica los PRAGMA obligatorios:
 * sin `foreign_keys = ON`, SQLite ignora las claves foraneas declaradas.
 * En PostgreSQL las llaves foraneas se respetan de forma nativa.
 */
async function crearClientePrisma() {
  const prisma = new PrismaClient();
  if (!esPostgres) {
    await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL;');
    await prisma.$queryRawUnsafe('PRAGMA foreign_keys = ON;');
    await prisma.$queryRawUnsafe('PRAGMA busy_timeout = 5000;');
    await prisma.$queryRawUnsafe('PRAGMA synchronous = NORMAL;');
  }
  return prisma;
}

async function verificarPragmas(prisma) {
  if (esPostgres) {
    await prisma.$queryRaw`SELECT 1 AS ok`;
    return { foreignKeys: true, journalMode: 'postgresql' };
  }
  const fk = await prisma.$queryRawUnsafe('PRAGMA foreign_keys;');
  const wal = await prisma.$queryRawUnsafe('PRAGMA journal_mode;');
  return { foreignKeys: fk[0]?.foreign_keys === 1, journalMode: wal[0]?.journal_mode };
}

module.exports = { crearClientePrisma, verificarPragmas, esPostgres, esProveedorPostgres };
