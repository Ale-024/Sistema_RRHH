import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import BusEventos from '../src/shared/event-bus';
import reloj from '../src/shared/reloj';
import { crearApp } from '../src/app';
import { crearBaseTemporal } from './helpers/db-temporal';
import { loginConMfa } from './helpers/login-con-mfa';

/**
 * Pruebas de seguridad y reglas de la Fase 2 (criterios de finalizacion):
 * - alcance departamental de un GERENTE_DEPTO
 * - inmutabilidad de la auditoria (trigger)
 * - un unico contrato vigente por empleado
 * - rotacion de refresh token con deteccion de reuso
 */
let base;
let app;
let prisma;
const CLAVE = Buffer.alloc(32, 7).toString('base64');

async function login(email) {
  return loginConMfa(app, email);
}

beforeAll(async () => {
  base = await crearBaseTemporal();
  prisma = base.prisma;

  // Organizacion de prueba: dos departamentos.
  const deptoA = await prisma.departamento.create({ data: { nombre: 'Depto A' } });
  const deptoB = await prisma.departamento.create({ data: { nombre: 'Depto B' } });
  const puestoA = await prisma.puesto.create({
    data: { titulo: 'Analista A', departamento_id: deptoA.id },
  });
  const puestoB = await prisma.puesto.create({
    data: { titulo: 'Analista B', departamento_id: deptoB.id },
  });

  const bcrypt = (await import('bcryptjs')).default;
  const hash = await bcrypt.hash('clave12345', 10);

  async function crearUsuarioConEmpleado(email, nombres, puestoId) {
    const usuario = await prisma.usuario.create({
      data: { email, password_hash: hash, estado: 'ACTIVO' },
    });
    await prisma.empleado.create({
      data: {
        usuario_id: usuario.id,
        puesto_id: puestoId,
        nombres,
        apellidos: 'Prueba',
        dni: `${email}@dni`,
        fecha_ingreso: new Date(),
      },
    });
    return usuario;
  }

  // RRHH global.
  const rrhh = await crearUsuarioConEmpleado('rrhh@test.hn', 'Rosa', puestoA.id);
  const rolRRHH = await prisma.rol.findUnique({ where: { codigo: 'RRHH_SUP' } });
  await prisma.usuarioRol.create({ data: { usuarioId: rrhh.id, rolId: rolRRHH.id } });

  // Gerente con alcance SOLO al departamento A.
  const gerente = await crearUsuarioConEmpleado('gerente@test.hn', 'Gustavo', puestoA.id);
  const rolGerente = await prisma.rol.findUnique({ where: { codigo: 'GERENTE_DEPTO' } });
  await prisma.usuarioRol.create({
    data: { usuarioId: gerente.id, rolId: rolGerente.id, scopeDepartamentoId: deptoA.id },
  });

  // Dos empleados en departamentos distintos, cada uno con su contrato vigente.
  const empA = await crearUsuarioConEmpleado('empleadoa@test.hn', 'Ana', puestoA.id);
  const rolEmp = await prisma.rol.findUnique({ where: { codigo: 'EMPLEADO' } });
  await prisma.usuarioRol.create({ data: { usuarioId: empA.id, rolId: rolEmp.id } });
  await prisma.contrato.create({
    data: {
      empleado_id: (await prisma.empleado.findUnique({ where: { usuario_id: empA.id } })).id,
      modalidad: 'PERMANENTE',
      salarioBaseCent: 1500000,
      periodicidad: 'MENSUAL',
      vigenciaDesde: new Date(),
    },
  });

  const empB = await crearUsuarioConEmpleado('empleadob@test.hn', 'Bruno', puestoB.id);
  await prisma.usuarioRol.create({ data: { usuarioId: empB.id, rolId: rolEmp.id } });
  await prisma.contrato.create({
    data: {
      empleado_id: (await prisma.empleado.findUnique({ where: { usuario_id: empB.id } })).id,
      modalidad: 'PERMANENTE',
      salarioBaseCent: 1800000,
      periodicidad: 'MENSUAL',
      vigenciaDesde: new Date(),
    },
  });

  app = crearApp({
    prisma,
    bus: new BusEventos(),
    clock: reloj,
    entorno: {
      PORT: 0,
      CLAVE_CIFRADO: CLAVE,
      origenesPermitidos: ['http://localhost:5173'],
    },
  });
});

afterAll(async () => {
  await base.limpiar();
});

describe('Fase 2: seguridad y reglas', () => {
  it('un GERENTE_DEPTO solo ve empleados de su departamento', async () => {
    const token = await login('gerente@test.hn');
    const res = await request(app)
      .get('/api/admin/employees')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const deptos = new Set(res.body.map((e) => e.puesto.departamento.nombre));
    expect(deptos).toEqual(new Set(['Depto A']));
  });

  it('RRHH con lectura global ve todos los departamentos', async () => {
    const token = await login('rrhh@test.hn');
    const res = await request(app)
      .get('/api/admin/employees')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(4);
  });

  it('la auditoria es append-only: UPDATE y DELETE fallan por trigger', async () => {
    await prisma.auditoria.create({
      data: { entidad: 'Prueba', accion: 'CREAR' },
    });
    let errorUpdate = null;
    try {
      await prisma.$executeRawUnsafe(`UPDATE "Auditoria" SET entidad = 'X'`);
    } catch (e) {
      errorUpdate = e;
    }
    expect(String(errorUpdate)).toContain('AUDITORIA_INMUTABLE');

    let errorDelete = null;
    try {
      await prisma.$executeRawUnsafe(`DELETE FROM "Auditoria"`);
    } catch (e) {
      errorDelete = e;
    }
    expect(String(errorDelete)).toContain('AUDITORIA_INMUTABLE');
  });

  it('no pueden existir dos contratos vigentes para el mismo empleado', async () => {
    const empleado = await prisma.empleado.findFirst({
      where: { usuario: { email: 'empleadoa@test.hn' } },
    });
    let error = null;
    try {
      await prisma.contrato.create({
        data: {
          empleado_id: empleado.id,
          modalidad: 'POR_HORA',
          salarioBaseCent: 10000,
          periodicidad: 'MENSUAL',
          vigenciaDesde: new Date(),
        },
      });
    } catch (e) {
      error = e;
    }
    expect(error).not.toBeNull();
  });

  it('las operaciones sensibles generan registros de auditoria', async () => {
    const token = await login('rrhh@test.hn');
    await request(app)
      .post('/api/admin/employees')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'nuevo@test.hn',
        password: 'temporal123',
        nombres: 'Nueva',
        apellidos: 'Contratacion',
        dni: '9988776655001',
        fecha_ingreso: '2026-01-15',
        puesto_id: (
          await prisma.puesto.findFirst({ where: { titulo: 'Analista A' } })
        ).id,
        modalidad: 'PERMANENTE',
        salario: 25000,
        periodicidad: 'MENSUAL',
      });

    const registro = await prisma.auditoria.findFirst({
      where: { entidad: 'Empleado', accion: 'CREAR' },
    });
    expect(registro).not.toBeNull();
  });

  it('el refresh rota el token y detecta el reuso revocando la familia', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'empleadoa@test.hn', password: 'clave12345' });
    expect(loginRes.status).toBe(200);

    const cookieOriginal = loginRes.headers['set-cookie']
      .find((c) => c.startsWith('sirh_refresh='))
      ?.split(';')[0];
    expect(cookieOriginal).toBeTruthy();

    // Primera rotacion con el token original: exito.
    const primera = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', cookieOriginal);
    expect(primera.status).toBe(200);
    expect(primera.body.token).toBeTruthy();

    const { sha256 } = await import('../src/modules/iam/application/iniciar-sesion.usecase');
    const familiaOriginal = (
      await prisma.sesionRefresh.findUnique({
        where: { tokenHash: sha256(cookieOriginal.split('=')[1]) },
      })
    ).familiaId;

    // Reuso del token ya rotado: 401 y revocacion de toda la familia.
    const reuso = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', cookieOriginal);
    expect(reuso.status).toBe(401);

    const sesionesFamilia = await prisma.sesionRefresh.findMany({
      where: { familiaId: familiaOriginal },
    });
    expect(sesionesFamilia.length).toBeGreaterThanOrEqual(2);
    for (const sesion of sesionesFamilia) {
      expect(sesion.revocadoEn).not.toBeNull();
    }
  });

  it('cinco intentos fallidos bloquean la cuenta', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({ email: 'empleadob@test.hn', password: 'incorrecta' });
    }
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'empleadob@test.hn', password: 'clave12345' });
    expect(res.status).toBe(403);
    expect(res.body.type).toContain('bloqueada');
  });

  it('un usuario sin permiso recibe 403 en zona administrativa', async () => {
    const token = await login('empleadoa@test.hn');
    const res = await request(app)
      .get('/api/admin/employees')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
