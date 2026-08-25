const { execSync } = require('node:child_process');
const crypto = require('node:crypto');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');

/**
 * Crea un schema efimero en PostgreSQL (Neon), aplica TODAS las migraciones
 * versionadas (incluidos los triggers/invariantes), siembra el catalogo IAM
 * minimo y devuelve un cliente Prisma aislado. El llamador debe ejecutar
 * limpiar() para eliminar el schema.
 *
 * Requiere TEST_DATABASE_URL (o DATABASE_URL) apuntando a PostgreSQL.
 * Para migraciones usa la conexion directa de Neon (sin `-pooler`).
 */
async function crearBaseTemporal() {
  const base = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!base || !/^postgres(ql)?:\/\//.test(base)) {
    throw new Error(
      'Los tests requieren una base PostgreSQL: define TEST_DATABASE_URL con la cadena de conexion (Neon), por ejemplo postgresql://usuario:clave@host/db?sslmode=require'
    );
  }

  const schema = `test_${crypto.randomBytes(6).toString('hex')}`;
  const admin = new PrismaClient({ datasources: { db: { url: base } } });
  await admin.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);

  // `?schema=` califica las consultas generadas por Prisma; `options=-c
  // search_path=` ademas alinea las raw queries y los triggers, que resuelven
  // nombres sin calificar via search_path (por defecto: public).
  const url = `${base}&schema=${schema}&options=-c%20search_path%3D${schema}`;
  // Sincroniza el env: modulos que detectan el proveedor al importarse
  // (p. ej. reportes) deben ver una URL PostgreSQL durante la prueba.
  process.env.DATABASE_URL = url;
  execSync('node node_modules/prisma/build/index.js migrate deploy', {
    cwd: path.join(__dirname, '..', '..'),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });

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
    'vacaciones:leer',
    'vacaciones:leer_global',
    'vacaciones:crear',
    'vacaciones:aprobar',
    'planilla:leer_global',
    'planilla:leer',
    'planilla:crear',
    'planilla:calcular',
    'planilla:cerrar',
    'planilla:registrar_pago',
    'planilla:administrar',
    'parametros:leer',
    'parametros:administrar',
    'usuarios:administrar',
    'auditoria:leer',
    'reportes:ver',
    'reportes:ver_global',
    'reportes:administrar',
    'observabilidad:leer',
    'autorizaciones:decidir',
  ];
  for (const codigo of PERMISOS) {
    await prisma.permisoSistema.create({ data: { codigo } });
  }

  const MATRIZ = {
    EMPLEADO: ['asistencia:marcar', 'asistencia:leer_propia', 'solicitudes:crear', 'vacaciones:leer', 'vacaciones:crear', 'planilla:leer'],
    ENCUESTADOR: ['asistencia:marcar', 'asistencia:leer_propia', 'solicitudes:crear', 'vacaciones:leer', 'vacaciones:crear', 'planilla:leer'],
    RRHH_SUP: [
      'empleados:leer', 'empleados:leer_global', 'empleados:crear',
      'empleados:actualizar', 'empleados:desvincular', 'contratos:crear',
      'organizacion:administrar', 'asistencia:leer_global',
      'asistencia:importar', 'asistencia:corregir', 'asistencia:cerrar',
      'asistencia:marcar', 'asistencia:leer_propia',
      'solicitudes:crear', 'solicitudes:revisar', 'solicitudes:leer_global', 'permisos:aprobar', 'vacaciones:leer_global', 'vacaciones:aprobar', 'vacaciones:leer', 'vacaciones:crear', 'planilla:leer_global', 'planilla:leer', 'planilla:crear', 'planilla:calcular', 'planilla:administrar', 'reportes:ver', 'reportes:administrar',
    ],
    GERENTE_DEPTO: ['reportes:ver'],
    DIRECCION: ['planilla:leer_global', 'planilla:leer', 'planilla:cerrar', 'planilla:registrar_pago', 'reportes:ver_global', 'autorizaciones:decidir', 'parametros:leer', 'asistencia:marcar', 'asistencia:leer_propia', 'solicitudes:crear', 'vacaciones:leer', 'vacaciones:crear'],
    ADMIN_TI: ['usuarios:administrar', 'organizacion:administrar', 'parametros:leer', 'parametros:administrar', 'auditoria:leer', 'observabilidad:leer'],
  };

  // Niveles de autoridad del Anexo (deben coincidir con catalogo-iam).
  const NIVELES_AUTORIDAD = {
    EMPLEADO: 10,
    ENCUESTADOR: 10,
    RRHH_SUP: 50,
    GERENTE_DEPTO: 30,
    DIRECCION: 90,
    ADMIN_TI: 50,
  };

  for (const [codigoRol, lista] of Object.entries(MATRIZ)) {
    const rol = await prisma.rol.create({
      data: { codigo: codigoRol, nombre: codigoRol, nivelAutoridad: NIVELES_AUTORIDAD[codigoRol] ?? 10 },
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
      await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await admin.$disconnect();
    },
  };
}

module.exports = { crearBaseTemporal };
