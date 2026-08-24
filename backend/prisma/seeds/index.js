const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { PERMISOS, ROLES } = require('./catalogo-iam');
const { sembrarOrganizacion } = require('./catalogo-organizacion');
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

  for (const { codigo, nombre, descripcion, permisos, nivelAutoridad } of ROLES) {
    const rol = await prisma.rol.upsert({
      where: { codigo },
      update: { nombre, descripcion, nivelAutoridad },
      create: { codigo, nombre, descripcion, nivelAutoridad },
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

async function sembrarCatalogos() {
  const existente = await prisma.turno.findFirst({ where: { nombre: 'Administrativo' } });
  if (!existente) {
    await prisma.turno.create({
      data: {
        nombre: 'Administrativo',
        horaEntrada: '08:00',
        horaSalida: '17:00',
        toleranciaMin: 10,
        minutosAlmuerzo: 60,
        diasSemana: '1,2,3,4,5',
      },
    });
  }

  const tipos = [
    ['PERS', 'Permiso personal', true, 6, false, 'Politica interna de permisos'],
    ['ENF', 'Enfermedad', true, 10, true, 'Constancia medica; validar con RRHH'],
    ['LUTO', 'Duelo por fallecimiento de familiar', true, 5, true, 'Codigo de Trabajo y politica interna'],
    ['MAT', 'Matrimonio', true, 5, true, 'Politica interna de permisos'],
    ['PAT', 'Paternidad', true, 3, true, 'Legislacion laboral vigente'],
    ['ESTU', 'Estudios', false, 10, true, 'Politica interna de permisos'],
  ];
  for (const [codigo, nombre, remunerado, diasMaxAnio, requiereSoporte, baseLegal] of tipos) {
    await prisma.tipoPermiso.upsert({
      where: { codigo },
      update: { nombre, remunerado, diasMaxAnio, requiereSoporte, baseLegal, activo: true },
      create: { codigo, nombre, remunerado, diasMaxAnio, requiereSoporte, baseLegal },
    });
  }
}

async function sembrarParametrosLegales() {
  const valores = [
    ['VAC_DIAS_ANIO_1', '10'],
    ['VAC_DIAS_ANIO_2', '12'],
    ['VAC_DIAS_ANIO_3', '15'],
    ['VAC_DIAS_ANIO_4', '20'],
  ];
  for (const [clave, valor] of valores) {
    // Los triggers trg_parametro_legal_solapado/update_solapado prohiben dos
    // filas activas con la misma clave: se actualiza la fila vigente existente
    // (cualquiera que sea su fecha de inicio) y solo se crea si no hay ninguna.
    const vigente = await prisma.parametroLegal.findFirst({
      where: { clave, activo: true },
      orderBy: { vigenciaDesde: 'asc' },
    });
    if (vigente) {
      await prisma.parametroLegal.update({ where: { id: vigente.id }, data: { valor, activo: true } });
    } else {
      await prisma.parametroLegal.create({
        data: { clave, valor, unidad: 'DIAS', vigenciaDesde: new Date('2020-01-01T00:00:00.000Z'), baseLegal: 'Codigo de Trabajo, escala vacacional' },
      });
    }
  }
}

async function sembrarAdmin() {
  let depto = await prisma.departamento.findFirst({ where: { nombre: 'Recursos Humanos' } });
  if (!depto) {
    depto = await prisma.departamento.create({
      data: { nombre: 'Recursos Humanos', descripcion: 'Departamento central de RRHH' },
    });
  }

  let puesto = await prisma.puesto.findFirst({ where: { titulo: 'Director de RRHH' } });
  if (!puesto) {
    puesto = await prisma.puesto.create({
      data: { titulo: 'Director de RRHH', departamento_id: depto.id },
    });
  }

  if (await prisma.usuario.findUnique({ where: { email: 'admin@sistemarrhh.com' } })) {
    return; // administrador ya sembrado
  }

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
        // INV5 (Anexo sec. 4): solo GERENTE_DEPTO lleva scope; RRHH_SUP es global.
        // Actor SISTEMA (asignadoPorId null) queda exento de INV3 en el arranque.
        create: [
          { rolId: rrhhRol.id },
        ],
      },
    },
  });
}

// Cuenta tecnica de administracion de TI (sin datos de negocio).
// La gestion de usuarios/roles/parametros vive aqui, separada del RRHH.
async function sembrarCuentaTecnica() {
  if (await prisma.usuario.findUnique({ where: { email: 'ia@sistemarrhh.com' } })) {
    return; // cuenta tecnica ya sembrada
  }

  const adminTiRol = await prisma.rol.findUnique({ where: { codigo: 'ADMIN_TI' } });
  const puesto = await prisma.puesto.findFirst({ where: { titulo: 'Administrador TI' } });

  const hashedPassword = await bcrypt.hash('Ia#Sistema2026', COSTE_BCRYPT);

  await prisma.usuario.create({
    data: {
      email: 'ia@sistemarrhh.com',
      password_hash: hashedPassword,
      estado: 'ACTIVO',
      debeCambiarPassword: true,
      empleado: {
        create: {
          ...(puesto ? { puesto_id: puesto.id } : {}),
          nombres: 'Asistente',
          apellidos: 'de Inteligencia Artificial',
          dni: '99999999A',
          dni_hmac: cifrador.hmac('99999999A'),
          fecha_ingreso: new Date(),
        },
      },
      roles: {
        create: [{ rolId: adminTiRol.id }],
      },
    },
  });
}

async function main() {
  console.log('Sembrando roles y permisos...');
  await sembrarIam();
  console.log('Sembrando catalogos iniciales (turnos)...');
  await sembrarCatalogos();
  console.log('Sembrando catalogo organizacional (departamentos y puestos)...');
  await sembrarOrganizacion(prisma);
  console.log('Sembrando parametros legales de vacaciones...');
  await sembrarParametrosLegales();
  console.log('Sembrando administrador inicial...');
  await sembrarAdmin();
  console.log('Sembrando cuenta tecnica de TI...');
  await sembrarCuentaTecnica();
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
