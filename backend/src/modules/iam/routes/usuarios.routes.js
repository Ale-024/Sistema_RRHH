const express = require('express');
const { z } = require('zod');
const {
  listarUsuarios,
  asignarRol,
  quitarRol,
  cambiarEstado,
  listarRoles,
} = require('../application/usuarios.usecase');
const validar = require('../../../shared/http/validar');
const { exigirPermiso } = require('../../../shared/http/autorizacion');
const { verificarToken, cargarPermisos } = require('../application/autenticacion');
const { ErrorAplicacion } = require('../../../shared/dominio/errores');

const esquemaAsignarRol = z.object({
  rolCodigo: z.string().min(2).max(30),
  scopeDepartamentoId: z.coerce.number().int().positive().optional(),
});

const esquemaEstado = z.object({
  estado: z.enum(['ACTIVO', 'INACTIVO', 'BLOQUEADO']),
});

const esquemaIds = z.object({
  id: z.coerce.number().int().positive(),
  rolId: z.coerce.number().int().positive().optional(),
});

/**
 * Rutas de administracion de usuarios y roles.
 * Montaje: /api/admin/usuarios y /api/admin/roles.
 */
function rutasAdminUsuarios(ctx) {
  const { prisma } = ctx;
  const router = express.Router();
  router.use(verificarToken, cargarPermisos, exigirPermiso('usuarios:administrar'));

  router.get('/usuarios', async (_req, res, next) => {
    try {
      res.json(await listarUsuarios(ctx));
    } catch (error) {
      next(error);
    }
  });

  router.get('/roles', async (_req, res, next) => {
    try {
      res.json(await listarRoles(ctx));
    } catch (error) {
      next(error);
    }
  });

  router.put(
    '/usuarios/:id/roles',
    validar({ params: esquemaIds.partial({ rolId: true }), body: esquemaAsignarRol }),
    async (req, res, next) => {
      try {
        const resultado = await asignarRol(req.params.id, req.body, ctx);
        await prisma.auditoria.create({
          data: {
            usuarioId: req.user.id,
            entidad: 'Usuario',
            entidadId: req.params.id,
            accion: 'ASIGNAR_ROL',
            despues: JSON.stringify(req.body),
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            requestId: req.contexto.requestId,
          },
        });
        res.json(resultado);
      } catch (error) {
        next(error);
      }
    }
  );

  router.delete(
    '/usuarios/:id/roles/:rolId',
    validar({ params: esquemaIds }),
    async (req, res, next) => {
      try {
        const resultado = await quitarRol(req.params.id, req.params.rolId, ctx);
        await prisma.auditoria.create({
          data: {
            usuarioId: req.user.id,
            entidad: 'Usuario',
            entidadId: req.params.id,
            accion: 'QUITAR_ROL',
            antes: JSON.stringify({ rolId: req.params.rolId }),
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            requestId: req.contexto.requestId,
          },
        });
        res.json(resultado);
      } catch (error) {
        next(error);
      }
    }
  );

  router.put(
    '/usuarios/:id/estado',
    validar({ params: esquemaIds.partial({ rolId: true }), body: esquemaEstado }),
    async (req, res, next) => {
      try {
        const anterior = await prisma.usuario.findUnique({
          where: { id: req.params.id },
          select: { estado: true },
        });
        if (!anterior) throw new ErrorAplicacion('NO_ENCONTRADO', 404, 'Usuario no encontrado.');
        const resultado = await cambiarEstado(req.params.id, req.body.estado, ctx);
        await prisma.auditoria.create({
          data: {
            usuarioId: req.user.id,
            entidad: 'Usuario',
            entidadId: req.params.id,
            accion: 'CAMBIAR_ESTADO',
            antes: JSON.stringify({ estado: anterior.estado }),
            despues: JSON.stringify({ estado: req.body.estado }),
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            requestId: req.contexto.requestId,
          },
        });
        res.json(resultado);
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}

module.exports = { rutasAdminUsuarios };
