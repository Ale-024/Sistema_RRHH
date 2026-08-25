'use strict';

/**
 * Catálogo organizacional de Marketing Total, alineado a los actores del
 * documento de especificación: Empleado, Encuestador de campo, Supervisor
 * de RRHH, Gerente de departamento y Dirección. Los puestos marcados con
 * "rolSugerido" son orientativos: el rol RBAC se otorga por separado
 * (los elevados exigen el ciclo de autorización del Anexo).
 */
const CATALOGO_ORGANIZACIONAL = [
  {
    nombre: 'Dirección General',
    descripcion: 'Alta dirección de la empresa',
    puestos: [
      { titulo: 'Director General', rolSugerido: 'DIRECCION' },
    ],
  },
  {
    nombre: 'Recursos Humanos',
    descripcion: 'Gestión de talento humano',
    puestos: [
      { titulo: 'Supervisor de RRHH', rolSugerido: 'RRHH_SUP' },
    ],
  },
  {
    nombre: 'Operaciones',
    descripcion: 'Personal de planta y call center',
    puestos: [
      { titulo: 'Empleado Operativo', rolSugerido: 'EMPLEADO' },
    ],
  },
  {
    nombre: 'Investigación de Mercado',
    descripcion: 'Operaciones de campo y levantamiento de encuestas',
    puestos: [
      { titulo: 'Gerente de Departamento', rolSugerido: 'GERENTE_DEPTO' },
      { titulo: 'Encuestador de Campo', rolSugerido: 'ENCUESTADOR' },
    ],
  },
];

// Puestos fuera del catálogo de actores; se retiran si no tienen empleados.
const PUESTOS_RETIRADOS = [
  'Director de RRHH',
  'Analista de RRHH',
  'Coordinador de Encuestadores',
  'Gerente de Marketing',
  'Analista de Marketing',
  'Administrador TI',
];

// Departamentos que quedan fuera del catálogo; se retiran si quedan vacios.
const DEPARTAMENTOS_RETIRADOS = ['Marketing', 'Tecnología'];

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
        update: { rolSugerido: puesto.rolSugerido, departamento_id: departamento.id },
        create: { titulo: puesto.titulo, departamento_id: departamento.id, rolSugerido: puesto.rolSugerido },
      });
    }
  }

  // Limpieza best-effort de puestos retirados: solo si no tienen empleados
  // asignados (FK RESTRICT). Si estan en uso se conservan y queda registrado.
  for (const titulo of PUESTOS_RETIRADOS) {
    const puesto = await prisma.puesto.findFirst({
      where: { titulo, empleados: { none: {} } },
    });
    if (puesto) {
      try {
        await prisma.puesto.delete({ where: { id: puesto.id } });
      } catch {
        // En uso o con referencias: se conserva.
      }
    }
  }

  for (const nombre of DEPARTAMENTOS_RETIRADOS) {
    const departamento = await prisma.departamento.findFirst({
      where: { nombre, puestos: { none: {} } },
    });
    if (departamento) {
      try {
        await prisma.departamento.delete({ where: { id: departamento.id } });
      } catch {
        // Con referencias: se conserva.
      }
    }
  }
}

module.exports = { CATALOGO_ORGANIZACIONAL, sembrarOrganizacion };
