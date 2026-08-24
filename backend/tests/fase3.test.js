import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import BusEventos from '../src/shared/event-bus';
import reloj from '../src/shared/reloj';
import { crearApp } from '../src/app';
import { crearBaseTemporal } from './helpers/db-temporal';
import { consolidarDia } from '../src/modules/asistencia/application/consolidar-dia.usecase';
import { loginConMfa } from './helpers/login-con-mfa';

/**
 * Criterios de finalizacion de la Fase 3:
 * - reejecutar el consolidado del mismo dia no altera resultados
 * - un dia cerrado no admite modificacion (trigger)
 * - la importacion del mismo lote dos veces no duplica marcajes
 */
let base;
let app;
let prisma;
let datos;
const CLAVE = Buffer.alloc(32, 7).toString('base64');

async function login(email) {
  return loginConMfa(app, email);
}

beforeAll(async () => {
  base = await crearBaseTemporal();
  prisma = base.prisma;

  const bcrypt = (await import('bcryptjs')).default;
  const hash = await bcrypt.hash('clave12345', 10);

  // Organizacion: depto + puesto + turno administrativo.
  const depto = await prisma.departamento.create({ data: { nombre: 'Operaciones' } });
  const puesto = await prisma.puesto.create({
    data: { titulo: 'Tecnico', departamento_id: depto.id },
  });
  const turno = await prisma.turno.create({
    data: {
      nombre: 'Administrativo',
      horaEntrada: '08:00',
      horaSalida: '17:00',
      toleranciaMin: 10,
      minutosAlmuerzo: 60,
      diasSemana: '1,2,3,4,5',
    },
  });

  async function crearEmpleado(email, nombres) {
    const usuario = await prisma.usuario.create({
      data: { email, password_hash: hash, estado: 'ACTIVO' },
    });
    const empleado = await prisma.empleado.create({
      data: {
        usuario_id: usuario.id,
        puesto_id: puesto.id,
        nombres,
        apellidos: 'Prueba',
        dni: `dni-${email}`,
        fecha_ingreso: new Date(),
      },
    });
    await prisma.horarioEmpleado.create({
      data: { empleadoId: empleado.id, turnoId: turno.id, desde: new Date() },
    });
    return { usuario, empleado };
  }

  // RRHH global con todos los permisos de asistencia.
  const rrhh = await crearEmpleado('rrhh@test.hn', 'Rosa');
  const rolRRHH = await prisma.rol.findUnique({ where: { codigo: 'RRHH_SUP' } });
  await prisma.usuarioRol.create({ data: { usuarioId: rrhh.usuario.id, rolId: rolRRHH.id } });

  // Empleado operativo.
  const operario = await crearEmpleado('operario@test.hn', 'Omar');
  const rolEmp = await prisma.rol.findUnique({ where: { codigo: 'EMPLEADO' } });
  await prisma.usuarioRol.create({ data: { usuarioId: operario.usuario.id, rolId: rolEmp.id } });

  app = crearApp({
    prisma,
    bus: new BusEventos(),
    clock: reloj,
    entorno: {
      PORT: 0,
      CLAVE_CIFRADO: CLAVE,
      SEGUNDOS_ANTIRREPETICION: 0,
      origenesPermitidos: ['http://localhost:5173'],
    },
  });

  datos = { turno, operario, rrhh };
});

afterAll(async () => {
  await base.limpiar();
});

describe('Fase 3: asistencia', () => {
  it('el marcaje propio alterna entrada/salida y registra GPS opcional', async () => {
    const token = await login('operario@test.hn');
    const primera = await request(app)
      .post('/api/employee/attendance')
      .set('Authorization', `Bearer ${token}`)
      .send({ latitud: 14.0722, longitud: -87.1921 });
    expect(primera.status).toBe(200);
    expect(primera.body.data.tipo).toBe('ENTRADA');

    const segunda = await request(app)
      .post('/api/employee/attendance')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(segunda.status).toBe(200);
    expect(segunda.body.data.tipo).toBe('SALIDA');
  });

  it('la importacion del mismo lote dos veces no duplica marcajes', async () => {
    const token = await login('rrhh@test.hn');
    const { operario } = datos;
    const eventos = [
      { empleadoId: operario.empleado.id, ocurridoEn: '2026-08-20T13:00:00.000Z', tipo: 'ENTRADA' },
      { empleadoId: operario.empleado.id, ocurridoEn: '2026-08-20T22:00:00.000Z', tipo: 'SALIDA' },
    ];

    const primera = await request(app)
      .post('/api/admin/asistencia/importar-lote')
      .set('Authorization', `Bearer ${token}`)
      .send({ eventos });
    expect(primera.status).toBe(200);
    expect(primera.body.reporte).toMatchObject({ total: 2, aceptados: 2, duplicados: 0 });

    const segunda = await request(app)
      .post('/api/admin/asistencia/importar-lote')
      .set('Authorization', `Bearer ${token}`)
      .send({ eventos });
    expect(segunda.status).toBe(200);
    expect(segunda.body.reporte).toMatchObject({ total: 2, aceptados: 0, duplicados: 2 });

    const total = await prisma.marcaje.count({
      where: { empleadoId: operario.empleado.id, origen: 'IMPORTADO' },
    });
    expect(total).toBe(2);
  });

  it('reejecutar el consolidado del mismo dia no altera resultados', async () => {
    const { operario } = datos;
    const fecha = new Date(2026, 7, 21); // viernes 21/08/2026

    // Marcajes del dia: entrada puntual, salida tras jornada completa.
    await prisma.marcaje.createMany({
      data: [
        {
          empleadoId: operario.empleado.id,
          ocurridoEn: new Date('2026-08-21T14:00:00.000Z'),
          tipo: 'ENTRADA',
          hashEvento: `t1-${Date.now()}-e`,
        },
        {
          empleadoId: operario.empleado.id,
          ocurridoEn: new Date('2026-08-21T23:30:00.000Z'),
          tipo: 'SALIDA',
          hashEvento: `t1-${Date.now()}-s`,
        },
      ],
    });

    const ctxLocal = { prisma };
    await consolidarDia(fecha, ctxLocal);
    const primera = await prisma.registroAsistencia.findUnique({
      where: { empleadoId_fecha: { empleadoId: operario.empleado.id, fecha } },
    });
    expect(primera.estadoDia).toBe('PRESENTE');
    expect(primera.minutosTrabajados).toBeGreaterThan(0);

    await consolidarDia(fecha, ctxLocal);
    const segunda = await prisma.registroAsistencia.findUnique({
      where: { empleadoId_fecha: { empleadoId: operario.empleado.id, fecha } },
    });
    expect(segunda).toEqual(primera);
  });

  it('un dia cerrado no admite modificacion por trigger; la reapertura si', async () => {
    const token = await login('rrhh@test.hn');
    const { operario } = datos;
    const fecha = new Date(2026, 7, 21);
    const registro = await prisma.registroAsistencia.findUnique({
      where: { empleadoId_fecha: { empleadoId: operario.empleado.id, fecha } },
    });

    const cierre = await request(app)
      .post('/api/admin/asistencia/cierre')
      .set('Authorization', `Bearer ${token}`)
      .send({ desde: fecha.toISOString(), hasta: fecha.toISOString() });
    expect(cierre.status).toBe(200);

    // Correccion sobre dia cerrado: rechazada.
    const correccionCerrada = await request(app)
      .patch(`/api/admin/asistencia/${registro.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ estadoDia: 'AUSENTE', motivo: 'intento sobre dia cerrado' });
    expect(correccionCerrada.status).toBe(409);

    // El trigger bloquea tambien escritura directa.
    let errorTrigger = null;
    try {
      await prisma.$executeRawUnsafe(
        'UPDATE RegistroAsistencia SET estadoDia = ? WHERE id = ?',
        'AUSENTE',
        registro.id
      );
    } catch (e) {
      errorTrigger = e;
    }
    expect(String(errorTrigger)).toContain('ASISTENCIA_DIA_CERRADO');

    // Reapertura con motivo obligatorio y auditada.
    const sinMotivo = await request(app)
      .post('/api/admin/asistencia/reapertura')
      .set('Authorization', `Bearer ${token}`)
      .send({ empleadoId: operario.empleado.id, fecha: fecha.toISOString(), motivo: 'corto' });
    expect(sinMotivo.status).toBe(422);

    const reabrir = await request(app)
      .post('/api/admin/asistencia/reapertura')
      .set('Authorization', `Bearer ${token}`)
      .send({
        empleadoId: operario.empleado.id,
        fecha: fecha.toISOString(),
        motivo: 'correccion autorizada por RRHH',
      });
    expect(reabrir.status).toBe(200);

    const auditoria = await prisma.auditoria.findFirst({
      where: { entidad: 'RegistroAsistencia', accion: 'REABRIR_DIA' },
    });
    expect(auditoria).not.toBeNull();
  });

  it('un usuario EMPLEADO no puede cerrar ni importar', async () => {
    const token = await login('operario@test.hn');
    const cierre = await request(app)
      .post('/api/admin/asistencia/cierre')
      .set('Authorization', `Bearer ${token}`)
      .send({ desde: '2026-08-21', hasta: '2026-08-21' });
    expect(cierre.status).toBe(403);
  });
});
