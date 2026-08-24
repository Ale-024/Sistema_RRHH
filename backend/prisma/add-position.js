const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const depto = await prisma.departamento.findFirst();
  console.log('Departamento encontrado:', depto);
  
  const pos = await prisma.puesto.create({
    data: { titulo: 'Empleado', departamento_id: depto.id }
  });
  console.log('Puesto "Empleado" creado:', pos);
  
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
