import { describe, expect, it } from 'vitest';
import { crearBaseTemporal } from './helpers/db-temporal.js';
import { refrescarAsistencia } from '../src/modules/reportes/application/proyecciones.usecase.js';
import * as consultas from '../src/modules/reportes/application/reportes.usecase.js';
import { crearPdfReporte, crearXlsx } from '../src/modules/reportes/application/formatos.js';
import { codigoTotp, verificarCodigoTotp } from '../src/modules/iam/application/mfa.js';

describe('Fase 7 - reportes y endurecimiento', () => {
  it('refresca asistencia, respeta alcance y busca por FTS5', async () => {
    const db = await crearBaseTemporal();
    try {
      const departamento = await db.prisma.departamento.create({ data: { nombre: 'Operaciones' } });
      const puesto = await db.prisma.puesto.create({ data: { titulo: 'Analista', departamento_id: departamento.id } });
      const usuario = await db.prisma.usuario.create({ data: { email: 'ana.fase7@example.com', password_hash: 'hash' } });
      const empleado = await db.prisma.empleado.create({ data: {
        usuario_id: usuario.id, puesto_id: puesto.id, nombres: 'Ana', apellidos: 'Reportes', dni: 'F7-001', fecha_ingreso: new Date('2024-01-01'),
      } });
      await db.prisma.registroAsistencia.createMany({ data: [
        { empleadoId: empleado.id, fecha: new Date('2026-08-01'), estadoDia: 'PRESENTE', minutosTrabajados: 480 },
        { empleadoId: empleado.id, fecha: new Date('2026-08-02'), estadoDia: 'AUSENTE' },
        { empleadoId: empleado.id, fecha: new Date('2026-08-03'), estadoDia: 'TARDANZA', minutosTardanza: 12 },
      ] });
      await refrescarAsistencia({ prisma: db.prisma, desde: new Date('2026-08-01'), hasta: new Date('2026-08-31T23:59:59.999Z') });
      const contexto = { permisos: new Set(['reportes:ver']), scopeDepartamentos: [departamento.id] };
      const filas = await consultas.asistencia({ anio: 2026, mes: 8 }, contexto, { prisma: db.prisma });
      expect(filas).toHaveLength(1);
      expect(filas[0].diasPresente).toBe(2);
      expect(filas[0].diasAusente).toBe(1);
      expect((await consultas.buscarEmpleados('Ana Rep', contexto, { prisma: db.prisma }))[0].id).toBe(empleado.id);
    } finally { await db.limpiar(); }
  });

  it('devuelve personal por proyecto y exportaciones validas', async () => {
    const db = await crearBaseTemporal();
    try {
      const departamento = await db.prisma.departamento.create({ data: { nombre: 'Proyectos' } });
      const puesto = await db.prisma.puesto.create({ data: { titulo: 'Consultor', departamento_id: departamento.id } });
      const usuario = await db.prisma.usuario.create({ data: { email: 'proyecto.fase7@example.com', password_hash: 'hash' } });
      const empleado = await db.prisma.empleado.create({ data: {
        usuario_id: usuario.id, puesto_id: puesto.id, nombres: 'Luis', apellidos: 'Proyecto', dni: 'F7-002', fecha_ingreso: new Date('2024-01-01'),
      } });
      const proyecto = await db.prisma.proyecto.create({ data: { codigo: 'P-01', nombre: 'Migracion' } });
      await db.prisma.asignacionProyecto.create({ data: { proyectoId: proyecto.id, empleadoId: empleado.id, desde: new Date('2026-01-01') } });
      const filas = await consultas.personalPorProyecto({ anio: 2026 }, { permisos: new Set(['reportes:ver']), scopeDepartamentos: [departamento.id] }, { prisma: db.prisma });
      expect(filas[0].proyecto).toBe('P-01');
      expect(crearXlsx(filas).subarray(0, 2).toString()).toBe('PK');
      expect(crearPdfReporte('prueba', filas).subarray(0, 8).toString()).toBe('%PDF-1.4');
    } finally { await db.limpiar(); }
  });

  it('calcula y valida TOTP con tolerancia de reloj', () => {
    const secreto = 'JBSWY3DPEHPK3PXP';
    const ahora = Date.UTC(2026, 7, 24, 12, 0, 0);
    const codigo = codigoTotp(secreto, ahora);
    expect(codigo).toMatch(/^\d{6}$/);
    expect(verificarCodigoTotp(secreto, codigo, ahora + 30000)).toBe(true);
    expect(verificarCodigoTotp(secreto, '000000', ahora)).toBe(false);
  });
});
