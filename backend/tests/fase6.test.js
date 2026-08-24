import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import BusEventos from '../src/shared/event-bus';
import reloj from '../src/shared/reloj';
import { crearApp } from '../src/app';
import { crearBaseTemporal } from './helpers/db-temporal';
import { calcularDetalle } from '../src/modules/planilla/domain/nomina-core/calcular-detalle';
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
  const departamento = await prisma.departamento.create({ data: { nombre: 'Operaciones F6' } });
  const puesto = await prisma.puesto.create({ data: { titulo: 'Analista F6', departamento_id: departamento.id } });
  async function crearPersona(email, nombres, rolCodigo) {
    const usuario = await prisma.usuario.create({ data: { email, password_hash: passwordHash, estado: 'ACTIVO' } });
    const empleado = await prisma.empleado.create({ data: { usuario_id: usuario.id, puesto_id: puesto.id, nombres, apellidos: 'Prueba', dni: `dni-${email}`, fecha_ingreso: new Date('2020-01-01') } });
    const rol = await prisma.rol.findUnique({ where: { codigo: rolCodigo } });
    await prisma.usuarioRol.create({ data: { usuarioId: usuario.id, rolId: rol.id } });
    return { usuario, empleado };
  }
  const trabajador = await crearPersona('trabajador-f6@test.hn', 'Tania', 'EMPLEADO');
  const rrhh = await crearPersona('rrhh-f6@test.hn', 'Rafael', 'RRHH_SUP');
  const direccion = await crearPersona('direccion-f6@test.hn', 'Diana', 'DIRECCION');
  await prisma.contrato.create({ data: { empleado_id: trabajador.empleado.id, modalidad: 'PERMANENTE', salarioBaseCent: 1000000, periodicidad: 'MENSUAL', vigenciaDesde: new Date('2020-01-01') } });
  app = crearApp({ prisma, bus: new BusEventos(), clock: reloj, entorno: { PORT: 0, CLAVE_CIFRADO: Buffer.alloc(32, 8).toString('base64'), SEGUNDOS_ANTIRREPETICION: 0, origenesPermitidos: ['http://localhost:5173'] } });
  datos = { trabajador, rrhh, direccion };
});

afterAll(async () => { await base.limpiar(); });

const entradaBase = {
  contrato: { modalidad: 'PERMANENTE', salarioBaseCent: 1000000, periodicidad: 'MENSUAL', aplicaIhss: true, aplicaRap: true },
  periodo: { tipo: 'ORDINARIA', diasPeriodo: 30 },
  asistencia: { diasTrabajados: 30, diasAusenciaInjustificada: 0, diasPagables: 30, horasJornada: 8, horasExtraDiurnas: 0, horasExtraNocturnas: 0 },
  parametros: { TECHO_IHSS: '1190313', IHSS_EM_TRAB: '0.025', IHSS_IVM_TRAB: '0.025', IHSS_EM_PATR: '0.05', IHSS_IVM_PATR: '0.035', RAP_PISO_CENT: '0', RAP_TRAB: '0.015', RAP_PATR: '0.015' },
};

describe('Fase 6: planilla CU05', () => {
  it('GOLDEN-01 calcula salario completo debajo del techo con cuadre exacto', () => {
    const detalle = calcularDetalle(entradaBase);
    expect(detalle.totalIngresosCent).toBe(1000000);
    expect(detalle.totalDeduccionesCent).toBe(65000);
    expect(detalle.totalAportesPatronalesCent).toBe(100000);
    expect(detalle.netoPagarCent).toBe(detalle.totalIngresosCent - detalle.totalDeduccionesCent);
  });

  it('GOLDEN-02 aplica techo IHSS y deja la traza del parametro', () => {
    const detalle = calcularDetalle({ ...entradaBase, contrato: { ...entradaBase.contrato, salarioBaseCent: 2000000 } });
    const ihss = detalle.lineas.find((linea) => linea.conceptoCodigo === 'IHSS_EM_TRAB');
    expect(ihss.montoCent).toBe(59516);
    expect(ihss.detalleCalculo).toContain('TECHO_IHSS');
  });

  it('GOLDEN-03/04 soporta modalidad por dia y por proyecto', () => {
    const porDia = calcularDetalle({ ...entradaBase, contrato: { ...entradaBase.contrato, modalidad: 'POR_DIA', salarioBaseCent: 50000 }, asistencia: { ...entradaBase.asistencia, diasTrabajados: 10 } });
    const proyecto = calcularDetalle({ ...entradaBase, contrato: { ...entradaBase.contrato, modalidad: 'POR_PROYECTO', salarioBaseCent: 250000 }, asistencia: { ...entradaBase.asistencia, diasTrabajados: 3, unidadesValidadas: 4 } });
    expect(porDia.totalIngresosCent).toBe(500000);
    expect(proyecto.totalIngresosCent).toBe(1000000);
  });

  it('GOLDEN-05/09 incluye vacaciones, permisos, extras y redondeo al centavo', () => {
    const detalle = calcularDetalle({ ...entradaBase, asistencia: { ...entradaBase.asistencia, diasTrabajados: 28, diasAusenciaInjustificada: 2, diasPagables: 28, horasExtraDiurnas: 1.5 }, vacacionesGozadas: { dias: 2 }, permisosRemunerados: { dias: 1 }, parametros: { ...entradaBase.parametros, H_EXTRA_DIURNA_RECARGO: '0.25' } });
    expect(detalle.lineas.some((linea) => linea.conceptoCodigo === 'H_EXTRA_D')).toBe(true);
    expect(detalle.netoPagarCent).toBe(detalle.totalIngresosCent - detalle.totalDeduccionesCent);
    expect(Number.isInteger(detalle.netoPagarCent)).toBe(true);
  });

  it('GOLDEN-07/08 calcula decimo y liquidacion proporcional', () => {
    const decimo = calcularDetalle({ ...entradaBase, periodo: { tipo: 'DECIMO_TERCERO', diasPeriodo: 30, proporcionAnual: 1 } });
    const liquidacion = calcularDetalle({ ...entradaBase, periodo: { tipo: 'LIQUIDACION', diasPeriodo: 30, proporcionLiquidacion: 0.5 } });
    expect(decimo.lineas.find((linea) => linea.conceptoCodigo === 'SUELDO').montoCent).toBe(1000000);
    expect(liquidacion.lineas.find((linea) => linea.conceptoCodigo === 'SUELDO').montoCent).toBe(500000);
  });

  it('calcula, envia a revision, cierra con hash y registra pago', async () => {
    const rrhh = await login('rrhh-f6@test.hn');
    const direccion = await login('direccion-f6@test.hn');
    const creado = await request(app).post('/api/admin/payroll/periodos').set('Authorization', `Bearer ${rrhh}`).send({ codigo: '2026-08-M', tipo: 'ORDINARIA', periodicidad: 'MENSUAL', fechaInicio: '2026-08-01', fechaFin: '2026-08-31', fechaPago: '2026-09-01' });
    expect(creado.status).toBe(201);
    const id = creado.body.data.id;
    const calculado = await request(app).post(`/api/admin/payroll/periodos/${id}/calcular`).set('Authorization', `Bearer ${rrhh}`).send({});
    expect(calculado.status).toBe(202);
    expect(calculado.body.data.estado).toBe('CALCULADA');
    expect(calculado.body.data.totalNetoCent).toBe(935000);
    const enviado = await request(app).post(`/api/admin/payroll/periodos/${id}/enviar-revision`).set('Authorization', `Bearer ${rrhh}`).send({});
    expect(enviado.body.data.estado).toBe('EN_APROBACION');
    const cerrado = await request(app).post(`/api/admin/payroll/periodos/${id}/cerrar`).set('Authorization', `Bearer ${direccion}`).send({});
    expect(cerrado.status).toBe(200);
    expect(cerrado.body.data.hashCierre).toMatch(/^[a-f0-9]{64}$/);
    const pagado = await request(app).post(`/api/admin/payroll/periodos/${id}/registrar-pago`).set('Authorization', `Bearer ${direccion}`).send({});
    expect(pagado.body.data.estado).toBe('PAGADA');
    const detalle = await prisma.detallePlanilla.findFirst({ where: { periodoId: id, empleadoId: datos.trabajador.empleado.id } });
    const recibo = await request(app).get(`/api/employee/payroll/recibos/${detalle.id}`).set('Authorization', `Bearer ${await login('trabajador-f6@test.hn')}`);
    expect(recibo.status).toBe(200);
    expect(recibo.headers['content-type']).toContain('application/pdf');
    expect(recibo.body.subarray(0, 8).toString()).toBe('%PDF-1.4');
  });

  it('GOLDEN-06 crea un ajuste solo sobre un periodo cerrado y bloquea modificaciones', async () => {
    const rrhh = await login('rrhh-f6@test.hn');
    const periodos = await prisma.periodoPlanilla.findMany({ where: { codigo: '2026-08-M' } });
    const ajuste = await request(app).post(`/api/admin/payroll/periodos/${periodos[0].id}/ajuste`).set('Authorization', `Bearer ${rrhh}`).send({ codigo: '2026-08-M-A1' });
    expect(ajuste.status).toBe(201);
    expect(ajuste.body.data.periodoAjusteDeId).toBe(periodos[0].id);
    let error;
    try { await prisma.periodoPlanilla.update({ where: { id: periodos[0].id }, data: { totalNetoCent: 1 } }); } catch (cause) { error = cause; }
    expect(error).toBeTruthy();
    expect(await prisma.periodoPlanilla.findUnique({ where: { id: periodos[0].id } })).toMatchObject({ estado: 'PAGADA', totalNetoCent: 935000 });
  });
});
