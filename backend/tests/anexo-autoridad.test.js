import { describe, expect, it, vi } from 'vitest';
import { crearBaseTemporal } from './helpers/db-temporal.js';

// Cada prueba crea una base temporal aplicando todas las migraciones:
// el costo de arranque exige un margen mayor al default de 5s.
vi.setConfig({ testTimeout: 60_000 });
import {
  validarSolicitud,
  validarDecision,
  validarEjecucion,
  validarRevocacion,
} from '../src/modules/iam/application/autoridad-roles.js';

/**
 * Anexo de autoridad para otorgar roles.
 * Matriz de otorgamiento + invariantes 1 a 8 (dominio y triggers).
 *
 * Los usuarios de prueba se crean con asignadoPorId null (acto de
 * instalacion/SISTEMA), unico camino exento del requisito de autorizacion.
 */
async function crearUsuarioConRol(prisma, email, codigoRol) {
  const usuario = await prisma.usuario.create({
    data: { email, password_hash: 'hash', estado: 'ACTIVO' },
  });
  const rol = await prisma.rol.findUnique({ where: { codigo: codigoRol } });
  await prisma.usuarioRol.create({
    data: { usuarioId: usuario.id, rolId: rol.id, asignadoPorId: null },
  });
  return { usuario, rol };
}

/** Verifica que la operacion rechace y que el codigo aparezca en el error,
 *  incluyendo los metadatos con que Prisma envuelve los RAISE de triggers.
 *  Acepta una promesa o un thunk para funciones sincronicas. */
async function esperarCodigo(accion, codigo) {
  try {
    const resultado = typeof accion === 'function' ? accion() : accion;
    await resultado;
  } catch (error) {
    const texto = [
      error?.message ?? '',
      error?.codigo ?? '',
      JSON.stringify(error?.meta ?? {}),
      String(error?.cause?.message ?? ''),
    ].join(' | ');
    expect(texto).toContain(codigo);
    return;
  }
  throw new Error(`Se esperaba rechazo con ${codigo} pero la operacion fue exitosa.`);
}

describe('Anexo de autoridad para otorgar roles', () => {
  it('sembró los niveles de autoridad de la jerarquia', async () => {
    const db = await crearBaseTemporal();
    try {
      const niveles = {};
      for (const r of await db.prisma.rol.findMany()) niveles[r.codigo] = r.nivelAutoridad;
      expect(niveles).toMatchObject({
        DIRECCION: 90,
        RRHH_SUP: 50,
        ADMIN_TI: 50,
        GERENTE_DEPTO: 30,
        EMPLEADO: 10,
        ENCUESTADOR: 10,
      });
    } finally { await db.limpiar(); }
  });

  it('invariante 1: nadie se otorga un rol a si mismo (dominio y trigger)', async () => {
    const db = await crearBaseTemporal();
    try {
      // Usuario sin roles previos: evita que la incompatibilidad (inv 6)
      // se dispare antes que la autoasignacion.
      const { usuario: empleado } = await crearUsuarioConRol(db.prisma, 'inv1.emp@mkt.hn', 'EMPLEADO');
      await esperarCodigo(
        validarEjecucion(db.prisma, {
          ejecutorId: empleado.id, beneficiarioId: empleado.id, rolCodigo: 'ENCUESTADOR', scopeDepartamentoId: null, autorizacionId: null,
        }),
        'INV1_AUTOASIGNACION'
      );

      const rolEnc = await db.prisma.rol.findUnique({ where: { codigo: 'ENCUESTADOR' } });
      await esperarCodigo(
        db.prisma.$executeRaw`INSERT INTO "UsuarioRol" ("usuarioId", "rolId", "asignadoPorId") VALUES (${empleado.id}, ${rolEnc.id}, ${empleado.id})`,
        'INV1_AUTOASIGNACION'
      );
    } finally { await db.limpiar(); }
  });

  it('invariantes 2 y 3: ADMIN_TI no otorga RRHH_SUP sin autorizacion previa', async () => {
    const db = await crearBaseTemporal();
    try {
      const { usuario: ti } = await crearUsuarioConRol(db.prisma, 'inv3.ti@mkt.hn', 'ADMIN_TI');
      const { usuario: victima } = await crearUsuarioConRol(db.prisma, 'inv3.victima@mkt.hn', 'EMPLEADO');

      await esperarCodigo(
        validarEjecucion(db.prisma, {
          ejecutorId: ti.id, beneficiarioId: victima.id, rolCodigo: 'RRHH_SUP',
          scopeDepartamentoId: null, autorizacionId: null,
        }),
        'INV3_SIN_AUTORIZACION_VIGENTE'
      );

      // El trigger SQL es ultima linea de defensa; se verifica por SQL crudo
      // porque Prisma enmascara los RAISE(ABORT) de triggers como P2003.
      const rolRh = await db.prisma.rol.findUnique({ where: { codigo: 'RRHH_SUP' } });
      await esperarCodigo(
        db.prisma.$executeRaw`INSERT INTO "UsuarioRol" ("usuarioId", "rolId", "asignadoPorId") VALUES (${victima.id}, ${rolRh.id}, ${ti.id})`,
        'INV3_SIN_AUTORIZACION_VIGENTE'
      );
    } finally { await db.limpiar(); }
  });

  it('invariante 5: GERENTE_DEPTO exige alcance y los demas lo prohiben', async () => {
    const db = await crearBaseTemporal();
    try {
      const { usuario: ti } = await crearUsuarioConRol(db.prisma, 'inv5.ti@mkt.hn', 'ADMIN_TI');
      const { usuario: victima } = await crearUsuarioConRol(db.prisma, 'inv5.victima@mkt.hn', 'EMPLEADO');

      await esperarCodigo(
        validarEjecucion(db.prisma, {
          ejecutorId: ti.id, beneficiarioId: victima.id, rolCodigo: 'GERENTE_DEPTO',
          scopeDepartamentoId: null, autorizacionId: null,
        }),
        'INV5_ALCANCE_INVALIDO'
      );

      const depto = await db.prisma.departamento.create({ data: { nombre: 'Inv5' } });
      await esperarCodigo(
        validarEjecucion(db.prisma, {
          ejecutorId: ti.id, beneficiarioId: victima.id, rolCodigo: 'EMPLEADO',
          scopeDepartamentoId: depto.id, autorizacionId: null,
        }),
        'INV5_ALCANCE_INVALIDO'
      );
    } finally { await db.limpiar(); }
  });

  it('matriz completa: DIRECCION solicita, decide y ADMIN_TI ejecuta RRHH_SUP', async () => {
    const db = await crearBaseTemporal();
    try {
      const prisma = db.prisma;
      const { usuario: ti } = await crearUsuarioConRol(prisma, 'matriz.ti@mkt.hn', 'ADMIN_TI');
      const { usuario: dir } = await crearUsuarioConRol(prisma, 'matriz.dir@mkt.hn', 'DIRECCION');
      const { usuario: victima } = await crearUsuarioConRol(prisma, 'matriz.victima@mkt.hn', 'EMPLEADO');

      // Solicitud segun matriz: solo DIRECCION solicita RRHH_SUP.
      validarSolicitud(['DIRECCION'], 'RRHH_SUP');
      await esperarCodigo(() => validarSolicitud(['RRHH_SUP'], 'RRHH_SUP'), 'MATRIZ_SOLICITUD_DENEGADA');

      const rolRh = await prisma.rol.findUnique({ where: { codigo: 'RRHH_SUP' } });
      let solicitud = await prisma.autorizacionRol.create({
        data: { beneficiarioId: victima.id, rolId: rolRh.id, solicitadaPorId: dir.id, motivo: 'test' },
      });

      // Decision: solo DIRECCION; el beneficiario jamas se autoautoriza (inv 4).
      solicitud = await prisma.autorizacionRol.findUnique({ where: { id: solicitud.id } });
      const solicitudConRol = { ...solicitud, rolCodigo: 'RRHH_SUP' };
      await esperarCodigo(
        () => validarDecision(solicitudConRol, ['EMPLEADO'], { autorizadaPorId: dir.id }),
        'MATRIZ_DECISION_DENEGADA'
      );
      await esperarCodigo(
        () => validarDecision(solicitudConRol, ['DIRECCION'], { autorizadaPorId: victima.id }),
        'INV4_DOBLE_CONTROL'
      );

      await prisma.autorizacionRol.update({
        where: { id: solicitud.id },
        data: { estado: 'AUTORIZADA', autorizadaPorId: dir.id, decididaEn: new Date() },
      });

      // Ejecucion por ADMIN_TI distinto del autorizador: permitida.
      const { rol, autorizacion } = await validarEjecucion(prisma, {
        ejecutorId: ti.id, beneficiarioId: victima.id, rolCodigo: 'RRHH_SUP',
        scopeDepartamentoId: null, autorizacionId: solicitud.id,
      });
      expect(rol.codigo).toBe('RRHH_SUP');
      expect(autorizacion.consumidaEn).toBeNull();

      // Ejecutor = autorizador esta prohibido (inv 4).
      await esperarCodigo(
        validarEjecucion(prisma, {
          ejecutorId: dir.id, beneficiarioId: victima.id, rolCodigo: 'RRHH_SUP',
          scopeDepartamentoId: null, autorizacionId: solicitud.id,
        }),
        'INV4_DOBLE_CONTROL'
      );
    } finally { await db.limpiar(); }
  });

  it('invariante 6: RRHH_SUP y DIRECCION no conviven; ADMIN_TI excluye todo', async () => {
    const db = await crearBaseTemporal();
    try {
      const prisma = db.prisma;
      const { usuario: sup } = await crearUsuarioConRol(prisma, 'inv6.sup@mkt.hn', 'RRHH_SUP');
      const rolDir = await prisma.rol.findUnique({ where: { codigo: 'DIRECCION' } });

      // Trigger: supervisor ya tiene RRHH_SUP; agregar DIRECCION aborta (SQL crudo).
      await esperarCodigo(
        prisma.$executeRaw`INSERT INTO "UsuarioRol" ("usuarioId", "rolId", "asignadoPorId") VALUES (${sup.id}, ${rolDir.id}, NULL)`,
        'INV6_ROLES_INCOMPATIBLES'
      );

      const { usuario: ti } = await crearUsuarioConRol(prisma, 'inv6.ti@mkt.hn', 'ADMIN_TI');
      const rolEmp = await prisma.rol.findUnique({ where: { codigo: 'EMPLEADO' } });
      await esperarCodigo(
        prisma.$executeRaw`INSERT INTO "UsuarioRol" ("usuarioId", "rolId", "asignadoPorId") VALUES (${ti.id}, ${rolEmp.id}, NULL)`,
        'INV6_ROLES_INCOMPATIBLES'
      );
    } finally { await db.limpiar(); }
  });

  it('invariante 7: no se retira el ultimo ADMIN_TI activo', async () => {
    const db = await crearBaseTemporal();
    try {
      const prisma = db.prisma;
      const { usuario: tiA } = await crearUsuarioConRol(prisma, 'inv7.a@mkt.hn', 'ADMIN_TI');
      const { usuario: tiB, rol } = await crearUsuarioConRol(prisma, 'inv7.b@mkt.hn', 'ADMIN_TI');

      // Con dos administradores, retirar uno es valido.
      await prisma.usuarioRol.delete({ where: { usuarioId_rolId: { usuarioId: tiB.id, rolId: rol.id } } });

      // Dominio: ya no queda nadie mas; revocar al ultimo se rechaza.
      await esperarCodigo(
        validarRevocacion(prisma, { ejecutorId: tiB.id, beneficiarioId: tiA.id, rolId: rol.id }),
        'INV7_ULTIMO_ADMINISTRADOR'
      );

      // Trigger (SQL crudo).
      await esperarCodigo(
        prisma.$executeRaw`DELETE FROM "UsuarioRol" WHERE "usuarioId" = ${tiA.id} AND "rolId" = ${rol.id}`,
        'INV7_ULTIMO_ADMINISTRADOR'
      );
    } finally { await db.limpiar(); }
  });

  it('acto de instalacion: asignadoPorId null permite el primer DIRECCION', async () => {
    const db = await crearBaseTemporal();
    try {
      const nuevo = await db.prisma.usuario.create({
        data: { email: 'primer.direccion@mkt.hn', password_hash: 'hash', estado: 'ACTIVO' },
      });
      const rolDir = await db.prisma.rol.findUnique({ where: { codigo: 'DIRECCION' } });
      await expect(
        db.prisma.usuarioRol.create({
          data: { usuarioId: nuevo.id, rolId: rolDir.id, asignadoPorId: null },
        })
      ).resolves.toMatchObject({ rolId: rolDir.id });
    } finally { await db.limpiar(); }
  });
});
