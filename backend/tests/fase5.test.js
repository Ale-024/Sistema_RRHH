import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import BusEventos from '../src/shared/event-bus';
import reloj from '../src/shared/reloj';
import { crearApp } from '../src/app';
import { crearBaseTemporal } from './helpers/db-temporal';
import { diasDerecho, devengarVacaciones } from '../src/modules/vacaciones/application/vacaciones.usecase';
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
  const departamento = await prisma.departamento.create({ data: { nombre: 'Operaciones F5' } });
  const puesto = await prisma.puesto.create({ data: { titulo: 'Analista F5', departamento_id: departamento.id } });
  async function crearEmpleado(email, nombres) {
    const usuario = await prisma.usuario.create({ data: { email, password_hash: passwordHash, estado: 'ACTIVO' } });
    const empleado = await prisma.empleado.create({ data: { usuario_id: usuario.id, puesto_id: puesto.id, nombres, apellidos: 'Prueba', dni: `dni-${email}`, fecha_ingreso: new Date('2022-01-03') } });
    return { usuario, empleado };
  }
  const empleado = await crearEmpleado('empleado-f5@test.hn', 'Eva');
  const rrhh = await crearEmpleado('rrhh-f5@test.hn', 'Rocio');
  const rolEmpleado = await prisma.rol.findUnique({ where: { codigo: 'EMPLEADO' } });
  const rolRrhh = await prisma.rol.findUnique({ where: { codigo: 'RRHH_SUP' } });
  await prisma.usuarioRol.create({ data: { usuarioId: empleado.usuario.id, rolId: rolEmpleado.id } });
  await prisma.usuarioRol.create({ data: { usuarioId: rrhh.usuario.id, rolId: rolRrhh.id } });
  app = crearApp({ prisma, bus: new BusEventos(), clock: reloj, entorno: { PORT: 0, CLAVE_CIFRADO: Buffer.alloc(32, 9).toString('base64'), SEGUNDOS_ANTIRREPETICION: 0, origenesPermitidos: ['http://localhost:5173'] } });
  datos = { empleado, rrhh };
});

afterAll(async () => { await base.limpiar(); });

describe('Fase 5: vacaciones', () => {
  it('calcula la escala parametrizada', () => {
    expect(diasDerecho(0, {})).toBe(0);
    expect(diasDerecho(1, { VAC_DIAS_ANIO_1: '10' })).toBe(10);
    expect(diasDerecho(2, { VAC_DIAS_ANIO_2: '12' })).toBe(12);
    expect(diasDerecho(3, { VAC_DIAS_ANIO_3: '15' })).toBe(15);
    expect(diasDerecho(5, { VAC_DIAS_ANIO_4: '20' })).toBe(20);
  });

  it('devenga periodos idempotentes y conserva el libro mayor', async () => {
    const fecha = new Date('2026-01-04');
    await devengarVacaciones({ prisma, fecha, empleadoId: datos.empleado.empleado.id });
    await devengarVacaciones({ prisma, fecha, empleadoId: datos.empleado.empleado.id });
    const periodos = await prisma.periodoVacacional.findMany({ where: { empleadoId: datos.empleado.empleado.id }, include: { movimientos: true } });
    expect(periodos).toHaveLength(4);
    expect(periodos.flatMap((periodo) => periodo.movimientos)).toHaveLength(4);
    expect(periodos.map((periodo) => periodo.diasDerecho)).toEqual([10, 12, 15, 20]);
  });

  it('crea, aprueba y descuenta vacaciones en una transaccion', async () => {
    const empleadoToken = await login('empleado-f5@test.hn');
    const rrhhToken = await login('rrhh-f5@test.hn');
    const periodo = await prisma.periodoVacacional.findFirst({ where: { empleadoId: datos.empleado.empleado.id, anioServicio: 4 } });
    const creada = await request(app).post('/api/employee/vacaciones/solicitudes').set('Authorization', `Bearer ${empleadoToken}`).send({ periodoId: periodo.id, fechaInicio: '2026-02-03', fechaFin: '2026-02-04' });
    expect(creada.status).toBe(201);
    const enviada = await request(app).post(`/api/employee/vacaciones/solicitudes/${creada.body.data.id}/enviar`).set('Authorization', `Bearer ${empleadoToken}`).send({});
    expect(enviada.status).toBe(200);
    const aprobada = await request(app).post(`/api/admin/vacaciones/solicitudes/${creada.body.data.id}/aprobar`).set('Authorization', `Bearer ${rrhhToken}`).send({});
    expect(aprobada.status).toBe(200);
    expect(aprobada.body.data.estado).toBe('APROBADO');
    const movimientos = await prisma.movimientoSaldoVacacion.findMany({ where: { periodoId: periodo.id }, orderBy: { id: 'asc' } });
    expect(movimientos.map((movimiento) => movimiento.tipo)).toEqual(['DEVENGO', 'GOCE']);
    expect(movimientos.reduce((total, movimiento) => total + movimiento.dias, 0)).toBe(18);
    const asistencia = await prisma.registroAsistencia.findMany({ where: { vacacionId: creada.body.data.id } });
    expect(asistencia.length).toBe(2);
    expect(asistencia.every((registro) => registro.estadoDia === 'VACACION')).toBe(true);
  });

  it('rechaza un goce que dejaría el saldo negativo y protege el movimiento', async () => {
    const periodo = await prisma.periodoVacacional.findFirst({ where: { empleadoId: datos.empleado.empleado.id, anioServicio: 1 } });
    expect(periodo).not.toBeNull();
    expect(await prisma.periodoVacacional.findUnique({ where: { id: periodo.id } })).not.toBeNull();
    let error;
    try { await prisma.movimientoSaldoVacacion.create({ data: { periodoId: periodo.id, tipo: 'GOCE', dias: -11 } }); } catch (cause) { error = cause; }
    expect(error).toBeTruthy();
    expect(await prisma.movimientoSaldoVacacion.count({ where: { periodoId: periodo.id } })).toBe(1);
    const movimiento = await prisma.movimientoSaldoVacacion.findFirst({ where: { periodoId: periodo.id, tipo: 'DEVENGO' } });
    try { await prisma.movimientoSaldoVacacion.update({ where: { id: movimiento.id }, data: { dias: 9 } }); } catch (cause) { error = cause; }
    expect(error).toBeTruthy();
    expect(await prisma.movimientoSaldoVacacion.findUnique({ where: { id: movimiento.id } })).toMatchObject({ dias: 10 });
  });
});
