const { execSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');

function aplicarMigracionesDirectamente(archivo) {
  // Fallback para el entorno Windows/Node donde el schema-engine de Prisma
  // 5.22 no devuelve el detalle de un error al abrir SQLite. Se ejecutan las
  // mismas migraciones versionadas; no se usa db push ni se omiten triggers.
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(archivo);
  const raizMigraciones = path.join(__dirname, '..', '..', 'prisma', 'migrations');
  const migraciones = fs
    .readdirSync(raizMigraciones)
    .filter((nombre) => fs.statSync(path.join(raizMigraciones, nombre)).isDirectory())
    .sort();
  for (const migracion of migraciones) {
    const sql = fs.readFileSync(path.join(raizMigraciones, migracion, 'migration.sql'), 'utf8');
    db.exec(sql);
  }
  db.close();
}

/**
 * Crea una base SQLite temporal aplicando TODAS las migraciones
 * (incluidos los triggers), siembra roles/permisos y devuelve un
 * cliente Prisma aislado. El llamador debe ejecutar limpiar().
 */
async function crearBaseTemporal() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sirh-test-'));
  const archivo = path.join(dir, 'test.db');
  const url = `file:${archivo}`;

  const env = { ...process.env, DATABASE_URL: url };
  try {
    execSync('node node_modules/prisma/build/index.js migrate deploy', {
      cwd: path.join(__dirname, '..', '..'),
      env,
      stdio: 'pipe',
    });
  } catch {
    fs.rmSync(archivo, { force: true });
    aplicarMigracionesDirectamente(archivo);
  }

  const prisma = new PrismaClient({ datasources: { db: { url } } });

  // Siembra minima de IAM (mismos catalogos del seed real).
  const PERMISOS = [
    'empleados:leer',
    'empleados:leer_global',
    'empleados:crear',
    'empleados:actualizar',
    'empleados:desvincular',
    'contratos:crear',
    'organizacion:administrar',
    'asistencia:marcar',
    'asistencia:leer_propia',
    'asistencia:leer_global',
    'asistencia:importar',
    'asistencia:corregir',
    'asistencia:cerrar',
    'solicitudes:crear',
    'solicitudes:revisar',
    'solicitudes:leer_global',
    'permisos:aprobar',
    'planilla:leer_global',
    'planilla:administrar',
    'usuarios:administrar',
    'auditoria:leer',
  ];
  for (const codigo of PERMISOS) {
    await prisma.permisoSistema.create({ data: { codigo } });
  }

  const MATRIZ = {
    EMPLEADO: ['asistencia:marcar', 'asistencia:leer_propia', 'solicitudes:crear'],
    ENCUESTADOR: ['asistencia:marcar', 'asistencia:leer_propia', 'solicitudes:crear'],
    RRHH_SUP: [
      'empleados:leer', 'empleados:leer_global', 'empleados:crear',
      'empleados:actualizar', 'empleados:desvincular', 'contratos:crear',
      'organizacion:administrar', 'asistencia:leer_global',
      'asistencia:importar', 'asistencia:corregir', 'asistencia:cerrar',
      'solicitudes:revisar', 'solicitudes:leer_global', 'permisos:aprobar', 'planilla:leer_global',
    ],
    GERENTE_DEPTO: ['empleados:leer', 'asistencia:leer_global', 'solicitudes:revisar', 'permisos:aprobar'],
    DIRECCION: ['planilla:leer_global', 'planilla:administrar', 'auditoria:leer'],
    ADMIN_TI: ['usuarios:administrar', 'organizacion:administrar', 'auditoria:leer'],
  };

  for (const [codigoRol, lista] of Object.entries(MATRIZ)) {
    const rol = await prisma.rol.create({
      data: { codigo: codigoRol, nombre: codigoRol },
    });
    for (const codigoPermiso of lista) {
      const permiso = await prisma.permisoSistema.findUnique({ where: { codigo: codigoPermiso } });
      await prisma.rolPermiso.create({
        data: { rolId: rol.id, permisoId: permiso.id },
      });
    }
  }

  return {
    prisma,
    url,
    async limpiar() {
      await prisma.$disconnect();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

module.exports = { crearBaseTemporal };
