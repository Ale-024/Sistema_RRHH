'use strict';

/**
 * Catálogo organizacional de Marketing Total.
 * Los puestos marcados con "rol sugerido" son orientativos: el rol RBAC se
 * asigna por separado al crear el usuario y no depende del puesto.
 */
const CATALOGO_ORGANIZACIONAL = [
  {
    nombre: 'Dirección General',
    descripcion: 'Alta dirección de la empresa',
    puestos: [
      { titulo: 'Director General', rolSugerido: 'DIRECCION' },
      { titulo: 'Gerente de Departamento', rolSugerido: 'GERENTE_DEPTO' },
    ],
  },
  {
    nombre: 'Recursos Humanos',
    descripcion: 'Departamento central de RRHH',
    puestos: [
      { titulo: 'Director de RRHH', rolSugerido: 'RRHH_SUP' },
      { titulo: 'Supervisor de RRHH', rolSugerido: 'RRHH_SUP' },
      { titulo: 'Analista de RRHH', rolSugerido: 'EMPLEADO' },
    ],
  },
  {
    nombre: 'Investigación de Mercado',
    descripcion: 'Operaciones de campo y levantamiento de encuestas',
    puestos: [
      { titulo: 'Coordinador de Encuestadores', rolSugerido: 'GERENTE_DEPTO' },
      { titulo: 'Encuestador de Campo', rolSugerido: 'ENCUESTADOR' },
    ],
  },
  {
    nombre: 'Marketing',
    descripcion: 'Estrategia y ejecución de marketing',
    puestos: [
      { titulo: 'Gerente de Marketing', rolSugerido: 'GERENTE_DEPTO' },
      { titulo: 'Analista de Marketing', rolSugerido: 'EMPLEADO' },
    ],
  },
  {
    nombre: 'Tecnología',
    descripcion: 'Infraestructura, sistemas y soporte',
    puestos: [{ titulo: 'Administrador TI', rolSugerido: 'ADMIN_TI' }],
  },
];

async function sembrarOrganizacion(prisma) {
  for (const entrada of CATALOGO_ORGANIZACIONAL) {
    const departamento = await prisma.departamento.upsert({
      where: { nombre: entrada.nombre },
      update: { descripcion: entrada.descripcion },
      create: { nombre: entrada.nombre, descripcion: entrada.descripcion },
    });

    for (const puesto of entrada.puestos) {
      await prisma.puesto.upsert({
        where: { titulo: puesto.titulo },
        update: { rolSugerido: puesto.rolSugerido },
        create: { titulo: puesto.titulo, departamento_id: departamento.id, rolSugerido: puesto.rolSugerido },
      });
    }
  }
}

module.exports = { CATALOGO_ORGANIZACIONAL, sembrarOrganizacion };
