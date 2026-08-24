import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import BusEventos from '../src/shared/event-bus';
import reloj from '../src/shared/reloj';
import { crearApp } from '../src/app';
import { crearBaseTemporal } from './helpers/db-temporal';
import { consolidarDia } from '../src/modules/asistencia/application/consolidar-dia.usecase';
import { loginConMfa } from './helpers/login-con-mfa';

let base;
let app;
let prisma;
let datos;

async function login(email) {
  return loginConMfa(app, email);
}

beforeAll(async () => {
  base = await crearBaseTemporal();
  prisma = base.prisma;
  const bcrypt = (await import('bcryptjs')).default;
  const passwordHash = await bcrypt.hash('clave12345', 10);

  const departamento = await prisma.departamento.create({ data: { nombre: 'Operaciones' } });
  const puesto = await prisma.puesto.create({
    data: { titulo: 'Analista', departamento_id: departamento.id },
  });
  const turno = await prisma.turno.create({
    data: { nombre: 'Administrativo', horaEntrada: '08:00', horaSalida: '17:00' },
  });

  async function empleadoConUsuario(email, nombres) {
    const usuario = await prisma.usuario.create({
      data: { email, password_hash: passwordHash, estado: 'ACTIVO' },
    });
    const empleado = await prisma.empleado.create({
      data: {
        usuario_id: usuario.id,
        puesto_id: puesto.id,
        nombres,
        apellidos: 'Prueba',
        dni: `dni-${email}`,
        fecha_ingreso: new Date('2020-01-01'),
      },
    });
    await prisma.horarioEmpleado.create({
      data: { empleadoId: empleado.id, turnoId: turno.id, desde: new Date('2020-01-01') },
    });
    return { usuario, empleado };
  }

  const empleado = await empleadoConUsuario('empleado-f4@test.hn', 'Elena');
  const rrhh = await empleadoConUsuario('rrhh-f4@test.hn', 'Rosa');
  const rolEmpleado = await prisma.rol.findUnique({ where: { codigo: 'EMPLEADO' } });
  const rolRrhh = await prisma.rol.findUnique({ where: { codigo: 'RRHH_SUP' } });
  await prisma.usuarioRol.create({ data: { usuarioId: empleado.usuario.id, rolId: rolEmpleado.id } });
  await prisma.usuarioRol.create({ data: { usuarioId: rrhh.usuario.id, rolId: rolRrhh.id } });

  const tipoPersonal = await prisma.tipoPermiso.upsert({
    where: { codigo: 'PERS' },
    update: {
      nombre: 'Permiso personal',
      diasMaxAnio: 20,
      remunerado: true,
      requiereSoporte: false,
    },
    create: {
      codigo: 'PERS',
      nombre: 'Permiso personal',
      diasMaxAnio: 20,
      remunerado: true,
      requiereSoporte: false,
    },
  });
  const tipoLuto = await prisma.tipoPermiso.create({
    data: {
      codigo: 'LUTO',
      nombre: 'Duelo',
      diasMaxAnio: 20,
      remunerado: true,
      requiereSoporte: true,
    },
  });

  app = crearApp({
    prisma,
    bus: new BusEventos(),
    clock: reloj,
    entorno: {
      PORT: 0,
      CLAVE_CIFRADO: Buffer.alloc(32, 7).toString('base64'),
      SEGUNDOS_ANTIRREPETICION: 0,
      origenesPermitidos: ['http://localhost:5173'],
    },
  });
  datos = { empleado, rrhh, tipoPersonal, tipoLuto };
});

afterAll(async () => {
  await base.limpiar();
});

describe('Fase 4: permisos', () => {
  it('crea, envia y conserva el historial de una solicitud', async () => {
    const token = await login('empleado-f4@test.hn');
    const creada = await request(app)
      .post('/api/employee/requests')
      .set('Authorization', `Bearer ${token}`)
      .send({
        tipoPermisoId: datos.tipoPersonal.id,
        fechaInicio: '2026-09-07',
        fechaFin: '2026-09-08',
        motivo: 'Trámite personal',
      });

    expect(creada.status).toBe(201);
    expect(creada.body.data.estado).toBe('SOLICITADO');
    expect(creada.body.data.folio).toMatch(/^PER-2026-/);

    const enviado = await request(app)
      .post(`/api/employee/requests/${creada.body.data.id}/enviar`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(enviado.status).toBe(200);
    expect(enviado.body.data.estado).toBe('EN_REVISION');

    const historial = await prisma.permisoHistorialEstado.findMany({
      where: { permisoId: creada.body.data.id },
      orderBy: { ocurridoEn: 'asc' },
    });
    expect(historial.map((item) => item.estadoNuevo)).toEqual(['SOLICITADO', 'EN_REVISION']);
  });

  it('aprueba, notifica y refleja el permiso en asistencia', async () => {
    const tokenEmpleado = await login('empleado-f4@test.hn');
    const tokenRrhh = await login('rrhh-f4@test.hn');
    const creada = await request(app)
      .post('/api/employee/requests')
      .set('Authorization', `Bearer ${tokenEmpleado}`)
      .send({
        tipoPermisoId: datos.tipoPersonal.id,
        fechaInicio: '2026-09-10',
        fechaFin: '2026-09-10',
        motivo: 'Cita médica',
      });
    await request(app)
      .post(`/api/employee/requests/${creada.body.data.id}/enviar`)
      .set('Authorization', `Bearer ${tokenEmpleado}`)
      .send({});

    const aprobada = await request(app)
      .post(`/api/admin/requests/${creada.body.data.id}/aprobar`)
      .set('Authorization', `Bearer ${tokenRrhh}`)
      .send({ motivo: 'Validado por RRHH' });
    expect(aprobada.status).toBe(200);
    expect(aprobada.body.data.estado).toBe('APROBADO');

    await new Promise((resolve) => setTimeout(resolve, 50));
    const notificacion = await prisma.notificacion.findFirst({
      where: { empleado_id: datos.empleado.empleado.id, mensaje: { contains: 'fue aprobada' } },
    });
    expect(notificacion).not.toBeNull();

    const fechaBase = new Date(aprobada.body.data.fechaInicio);
    const fecha = new Date(fechaBase.getFullYear(), fechaBase.getMonth(), fechaBase.getDate());
    await consolidarDia(fecha, { prisma });
    const asistencia = await prisma.registroAsistencia.findUnique({
      where: { empleadoId_fecha: { empleadoId: datos.empleado.empleado.id, fecha } },
    });
    expect(asistencia.estadoDia).toBe('PERMISO');
    expect(asistencia.permisoId).toBe(creada.body.data.id);
  });

  it('rechaza el solapamiento y obliga motivo al rechazar', async () => {
    const tokenEmpleado = await login('empleado-f4@test.hn');
    const tokenRrhh = await login('rrhh-f4@test.hn');
    const crear = (fechaInicio, fechaFin) => request(app)
      .post('/api/employee/requests')
      .set('Authorization', `Bearer ${tokenEmpleado}`)
      .send({ tipoPermisoId: datos.tipoPersonal.id, fechaInicio, fechaFin, motivo: 'Solicitud' });

    const primera = await crear('2026-09-15', '2026-09-16');
    await request(app).post(`/api/employee/requests/${primera.body.data.id}/enviar`).set('Authorization', `Bearer ${tokenEmpleado}`).send({});
    const segunda = await crear('2026-09-16', '2026-09-17');
    const solapada = await request(app).post(`/api/employee/requests/${segunda.body.data.id}/enviar`).set('Authorization', `Bearer ${tokenEmpleado}`).send({});
    expect(solapada.status).toBe(409);

    const rechazarSinMotivo = await request(app)
      .post(`/api/admin/requests/${primera.body.data.id}/rechazar`)
      .set('Authorization', `Bearer ${tokenRrhh}`)
      .send({});
    expect(rechazarSinMotivo.status).toBe(422);
    const rechazada = await request(app)
      .post(`/api/admin/requests/${primera.body.data.id}/rechazar`)
      .set('Authorization', `Bearer ${tokenRrhh}`)
      .send({ motivo: 'No cumple la programación' });
    expect(rechazada.status).toBe(200);
    expect(rechazada.body.data.estado).toBe('RECHAZADO');
  });

  it('exige soporte para el catálogo que lo requiere y protege la FSM en SQL', async () => {
    const tokenEmpleado = await login('empleado-f4@test.hn');
    const sinSoporte = await request(app)
      .post('/api/employee/requests')
      .set('Authorization', `Bearer ${tokenEmpleado}`)
      .send({
        tipoPermisoId: datos.tipoLuto.id,
        fechaInicio: '2026-10-01',
        fechaFin: '2026-10-01',
        motivo: 'Fallecimiento de familiar',
      });
    expect(sinSoporte.status).toBe(422);

    const creada = await prisma.solicitudPermiso.create({
      data: {
        folio: 'PER-2026-999999',
        empleadoId: datos.empleado.empleado.id,
        tipoPermisoId: datos.tipoPersonal.id,
        fechaInicio: new Date('2026-10-05'),
        fechaFin: new Date('2026-10-05'),
        diasHabiles: 1,
        motivo: 'Prueba de trigger',
      },
    });
    let error;
    try {
      await prisma.$executeRawUnsafe('UPDATE "SolicitudPermiso" SET "estado" = $1 WHERE "id" = $2', 'APROBADO', creada.id);
    } catch (cause) {
      error = cause;
    }
    expect(String(error)).toContain('PERMISO_TRANSICION_INVALIDA');
  });
});
