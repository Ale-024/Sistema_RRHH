const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { PERMISOS, ROLES } = require('./catalogo-iam');
const { crearCifrador } = require('../../src/shared/infra/cifrado');

const prisma = new PrismaClient();
const cifrador = crearCifrador(process.env.CLAVE_CIFRADO);
const COSTE_BCRYPT = 12;

async function sembrarIam() {
  for (const [codigo, descripcion] of PERMISOS) {
    await prisma.permisoSistema.upsert({
      where: { codigo },
      update: { descripcion },
      create: { codigo, descripcion },
    });
  }

  for (const { codigo, nombre, descripcion, permisos } of ROLES) {
    const rol = await prisma.rol.upsert({
      where: { codigo },
      update: { nombre, descripcion },
      create: { codigo, nombre, descripcion },
    });
    for (const codigoPermiso of permisos) {
      const permiso = await prisma.permisoSistema.findUnique({ where: { codigo: codigoPermiso } });
      await prisma.rolPermiso.upsert({
        where: { rolId_permisoId: { rolId: rol.id, permisoId: permiso.id } },
        update: {},
        create: { rolId: rol.id, permisoId: permiso.id },
      });
    }
  }
}

async function sembrarAdmin() {
  const depto = await prisma.departamento.create({
    data: { nombre: 'Recursos Humanos', descripcion: 'Departamento central de RRHH' },
  });

  const puesto = await prisma.puesto.create({
    data: { titulo: 'Director de RRHH', departamento_id: depto.id },
  });

  const adminRol = await prisma.rol.findUnique({ where: { codigo: 'ADMIN_TI' } });
  const rrhhRol = await prisma.rol.findUnique({ where: { codigo: 'RRHH_SUP' } });

  const hashedPassword = await bcrypt.hash('admin123', COSTE_BCRYPT);

  await prisma.usuario.create({
    data: {
      email: 'admin@sistemarrhh.com',
      password_hash: hashedPassword,
      estado: 'ACTIVO',
      debeCambiarPassword: false,
      empleado: {
        create: {
          puesto_id: puesto.id,
          nombres: 'Administrador',
          apellidos: 'Sistema',
          dni: '00000000A',
          dni_hmac: cifrador.hmac('00000000A'),
          fecha_ingreso: new Date(),
          telefono: '555-0000',
        },
      },
      roles: {
        create: [
          { rolId: adminRol.id },
          { rolId: rrhhRol.id, scopeDepartamentoId: depto.id },
        ],
      },
    },
  });
}

async function main() {
  console.log('Sembrando roles y permisos...');
  await sembrarIam();
  console.log('Sembrando administrador inicial...');
  await sembrarAdmin();
  console.log('Seed completado.');
  console.log('Admin Email: admin@sistemarrhh.com');
  console.log('Admin Password: admin123 (cambiar en produccion)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
