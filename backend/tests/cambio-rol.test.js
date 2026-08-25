import { describe, expect, it, vi } from 'vitest';
import { crearBaseTemporal } from './helpers/db-temporal.js';

// Cada prueba crea una base temporal aplicando todas las migraciones:
// el costo de arranque exige un margen mayor al default de 5s.
vi.setConfig({ testTimeout: 60_000 });

const {
  solicitarAutorizacion,
  decidirAutorizacion,
  asignarRol,
  quitarRol,
} = await import('../src/modules/iam/application/usuarios.usecase.js');

/**
 * Cambio/degradacion de rol en un solo ciclo: la solicitud REVOCAR lleva
 * rol destino base, DIRECCION autoriza y ADMIN_TI ejecuta el reemplazo.
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

describe('Cambio de rol (REVOCAR con rol destino)', () => {
  it('solicitar -> autorizar -> ejecutar deja un solo rol (el destino) y consume la autorizacion', async () => {
    const { prisma, limpiar } = await crearBaseTemporal();
    try {
      const direccion = await crearUsuarioConRol(prisma, 'dir@test', 'DIRECCION');
      const ti = await crearUsuarioConRol(prisma, 'ti@test', 'ADMIN_TI');
      const pedro = await crearUsuarioConRol(prisma, 'pedro@test', 'RRHH_SUP');

      const ctxDireccion = { prisma, ejecutor: { id: direccion.usuario.id, roles: ['DIRECCION'] } };
      const ctxTi = { prisma, ejecutor: { id: ti.usuario.id, roles: ['ADMIN_TI'] } };

      // Paso 1: el supervisor/direccion solicita el cambio con destino.
      const solicitud = await solicitarAutorizacion(
        { beneficiarioId: pedro.usuario.id, rolCodigo: 'RRHH_SUP', accion: 'REVOCAR', rolDestinoCodigo: 'ENCUESTADOR', motivo: 'Degradacion' },
        ctxDireccion
      );
      const autorizacionId = solicitud.data.id;

      // Paso 2: Direccion autoriza.
      await decidirAutorizacion(autorizacionId, { decision: 'AUTORIZADA' }, ctxDireccion);

      // Paso 3: TI ejecuta; el reemplazo ocurre en una sola transaccion.
      await asignarRol(pedro.usuario.id, { rolCodigo: 'ENCUESTADOR', autorizacionId }, ctxTi);

      const rolesFinales = await prisma.usuarioRol.findMany({
        where: { usuarioId: pedro.usuario.id },
        include: { rol: { select: { codigo: true } } },
      });
      expect(rolesFinales).toHaveLength(1);
      expect(rolesFinales[0].rol.codigo).toBe('ENCUESTADOR');

      const consumida = await prisma.autorizacionRol.findUnique({ where: { id: autorizacionId } });
      expect(consumida.estado).toBe('CONSUMIDA');
      expect(consumida.consumidaEn).not.toBeNull();
    } finally {
      await limpiar();
    }
  });

  it('rechaza un rol destino elevado', async () => {
    const { prisma, limpiar } = await crearBaseTemporal();
    try {
      const direccion = await crearUsuarioConRol(prisma, 'dir2@test', 'DIRECCION');
      const pedro = await crearUsuarioConRol(prisma, 'pedro2@test', 'RRHH_SUP');
      const ctxDireccion = { prisma, ejecutor: { id: direccion.usuario.id, roles: ['DIRECCION'] } };

      await expect(
        solicitarAutorizacion(
          { beneficiarioId: pedro.usuario.id, rolCodigo: 'RRHH_SUP', accion: 'REVOCAR', rolDestinoCodigo: 'ADMIN_TI' },
          ctxDireccion
        )
      ).rejects.toMatchObject({ codigo: 'ROL_DESTINO_INVALIDO' });
    } finally {
      await limpiar();
    }
  });

  it('la ejecucion con destino equivocado no valida la autorizacion', async () => {
    const { prisma, limpiar } = await crearBaseTemporal();
    try {
      const direccion = await crearUsuarioConRol(prisma, 'dir3@test', 'DIRECCION');
      const ti = await crearUsuarioConRol(prisma, 'ti3@test', 'ADMIN_TI');
      const pedro = await crearUsuarioConRol(prisma, 'pedro3@test', 'RRHH_SUP');
      const ctxDireccion = { prisma, ejecutor: { id: direccion.usuario.id, roles: ['DIRECCION'] } };
      const ctxTi = { prisma, ejecutor: { id: ti.usuario.id, roles: ['ADMIN_TI'] } };

      const solicitud = await solicitarAutorizacion(
        { beneficiarioId: pedro.usuario.id, rolCodigo: 'RRHH_SUP', accion: 'REVOCAR', rolDestinoCodigo: 'EMPLEADO' },
        ctxDireccion
      );
      const autorizacionId = solicitud.data.id;
      await decidirAutorizacion(autorizacionId, { decision: 'AUTORIZADA' }, ctxDireccion);

      // TI intenta asignar ENCUESTADOR cuando la autorizacion cubre EMPLEADO.
      await expect(
        asignarRol(pedro.usuario.id, { rolCodigo: 'ENCUESTADOR', autorizacionId }, ctxTi)
      ).rejects.toMatchObject({ codigo: 'DEGRADACION_SIN_AUTORIZACION' });

      // La autorizacion sigue vigente (no se consumio el intento fallido).
      const vigente = await prisma.autorizacionRol.findUnique({ where: { id: autorizacionId } });
      expect(vigente.consumidaEn).toBeNull();
    } finally {
      await limpiar();
    }
  });

  it('quitar el unico rol del usuario se rechaza con guia hacia el cambio de rol', async () => {
    const { prisma, limpiar } = await crearBaseTemporal();
    try {
      const ti = await crearUsuarioConRol(prisma, 'ti4@test', 'ADMIN_TI');
      const pedro = await crearUsuarioConRol(prisma, 'pedro4@test', 'EMPLEADO');
      const ctxTi = { prisma, ejecutor: { id: ti.usuario.id, roles: ['ADMIN_TI'] } };

      await expect(
        quitarRol(pedro.usuario.id, pedro.rol.id, ctxTi)
      ).rejects.toThrow(/cambio de rol/);
    } finally {
      await limpiar();
    }
  });
});
