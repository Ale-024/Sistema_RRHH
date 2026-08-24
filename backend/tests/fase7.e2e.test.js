import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import BusEventos from '../src/shared/event-bus';
import reloj from '../src/shared/reloj';
import { crearApp } from '../src/app';
import { crearBaseTemporal } from './helpers/db-temporal';
import { refrescarAsistencia } from '../src/modules/reportes/application/proyecciones.usecase';
import { codigoTotp } from '../src/modules/iam/application/mfa';

let base;
let app;
let prisma;
let usuario;
let secreto;

beforeAll(async () => {
  base = await crearBaseTemporal();
  prisma = base.prisma;
  const departamento = await prisma.departamento.create({ data: { nombre: 'E2E Reportes' } });
  const puesto = await prisma.puesto.create({ data: { titulo: 'Supervisor', departamento_id: departamento.id } });
  usuario = await prisma.usuario.create({ data: { email: 'e2e.rrhh@example.com', password_hash: await bcrypt.hash('clave12345', 10) } });
  await prisma.empleado.create({ data: { usuario_id: usuario.id, puesto_id: puesto.id, nombres: 'E2E', apellidos: 'Supervisor', dni: 'E2E-001', fecha_ingreso: new Date('2024-01-01') } });
  const rol = await prisma.rol.findUnique({ where: { codigo: 'RRHH_SUP' } });
  await prisma.usuarioRol.create({ data: { usuarioId: usuario.id, rolId: rol.id } });
  await prisma.registroAsistencia.create({ data: { empleadoId: (await prisma.empleado.findUnique({ where: { usuario_id: usuario.id } })).id, fecha: new Date('2026-08-01'), estadoDia: 'PRESENTE' } });
  await refrescarAsistencia({ prisma, desde: new Date('2026-08-01'), hasta: new Date('2026-08-31T23:59:59.999Z') });
  app = crearApp({ prisma, bus: new BusEventos(), clock: reloj, entorno: { PORT: 0, CLAVE_CIFRADO: Buffer.alloc(32, 7).toString('base64'), origenesPermitidos: ['http://localhost:5173'] } });
});

afterAll(async () => { await base.limpiar(); });

describe('Fase 7 - contratos HTTP autenticados', () => {
  it('obliga el enrolamiento MFA y bloquea el token de setup', async () => {
    const inicial = await request(app).post('/api/auth/login').send({ email: usuario.email, password: 'clave12345' });
    expect(inicial.status).toBe(200);
    expect(inicial.body.mfaSetupRequired).toBe(true);

    const bloqueado = await request(app).get('/api/admin/reportes/asistencia?anio=2026&mes=8').set('Authorization', `Bearer ${inicial.body.token}`);
    expect(bloqueado.status).toBe(403);

    const setup = await request(app).post('/api/auth/mfa/setup').set('Authorization', `Bearer ${inicial.body.token}`);
    secreto = setup.body.secret;
    const codigo = codigoTotp(secreto);
    expect((await request(app).post('/api/auth/mfa/verify').set('Authorization', `Bearer ${inicial.body.token}`).send({ code: codigo })).status).toBe(200);

    const normal = await request(app).post('/api/auth/login').send({ email: usuario.email, password: 'clave12345', otp: codigo });
    expect(normal.status).toBe(200);
    const reporte = await request(app).get('/api/admin/reportes/asistencia?anio=2026&mes=8').set('Authorization', `Bearer ${normal.body.token}`);
    expect(reporte.status).toBe(200);
    expect(reporte.body.data).toHaveLength(1);
  });
});
