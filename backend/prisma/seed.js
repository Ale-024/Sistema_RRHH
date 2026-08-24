const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');
  
  // 1. Create a default department
  const depto = await prisma.departamento.create({
    data: {
      nombre: 'Recursos Humanos',
      descripcion: 'Departamento central de RRHH'
    }
  });

  // 2. Create a default position
  const puesto = await prisma.puesto.create({
    data: {
      titulo: 'Director de RRHH',
      departamento_id: depto.id
    }
  });

  // 3. Create an initial ADMIN user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  await prisma.usuario.create({
    data: {
      email: 'admin@sistemarrhh.com',
      password_hash: hashedPassword,
      rol: 'ADMIN',
      activo: true,
      empleado: {
        create: {
          nombres: 'Administrador',
          apellidos: 'Sistema',
          dni: '00000000A',
          fecha_ingreso: new Date(),
          telefono: '555-0000',
          puesto_id: puesto.id
        }
      }
    }
  });

  console.log('Seed completed successfully.');
  console.log('Admin Email: admin@sistemarrhh.com');
  console.log('Admin Password: admin123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
