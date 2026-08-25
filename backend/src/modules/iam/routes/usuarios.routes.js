const express = require('express');
const { z } = require('zod');
const {
  listarUsuarios,
  asignarRol,
  quitarRol,
  solicitarAutorizacion,
  decidirAutorizacion,
  listarAutorizaciones,
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
  autorizacionId: z.coerce.number().int().positive().optional(),
});

const esquemaSolicitud = z.object({
  beneficiarioId: z.coerce.number().int().positive().optional(),
  // DIRECCION no tiene listados de usuarios/empleados: puede indicar el correo.
  email: z.string().trim().email().optional(),
  rolCodigo: z.string().min(2).max(30),
  // OTORGAR (default) | REVOCAR: ciclo simetrico para quitar roles elevados.
  accion: z.enum(['OTORGAR', 'REVOCAR']).default('OTORGAR'),
  scopeDepartamentoId: z.coerce.number().int().positive().optional(),
  motivo: z.string().trim().max(500).optional(),
});

const esquemaDecision = z.object({
  decision: z.enum(['AUTORIZADA', 'RECHAZADA']),
  motivo: z.string().trim().max(500).optional(),
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
 *
 * El anexo de autoridad separa la gestion de usuarios (ADMIN_TI,
 * usuarios:administrar) del ciclo de autorizacion de roles elevados,
 * donde intervienen RRHH_SUP (solicita) y DIRECCION (decide).
 */
function rutasAdminUsuarios(ctx) {
  const { prisma } = ctx;
  const router = express.Router();
  router.use(verificarToken, cargarPermisos);

  // Contexto con el ejecutor identificado para las invariantes del anexo.
  const ctxDe = (req) => ({ ...ctx, ejecutor: { id: req.user.id, roles: req.user.roles ?? [] } });

  const exigirCualquiera = (...permisos) => (req, res, next) => {
    const otorgados = req.contexto?.permisos;
    if (permisos.some((p) => otorgados?.has(p))) return next();
    next(new ErrorAplicacion('PERMISO_DENEGADO', 403, 'Permiso denegado.'));
  };

  router.get('/usuarios', exigirPermiso('usuarios:administrar'), async (_req, res, next) => {
    try {
      res.json(await listarUsuarios(ctx));
    } catch (error) {
      next(error);
    }
  });

  router.get('/roles', exigirPermiso('usuarios:administrar'), async (_req, res, next) => {
    try {
      res.json(await listarRoles(ctx));
    } catch (error) {
      next(error);
    }
  });

  router.put(
    '/usuarios/:id/roles',
    exigirPermiso('usuarios:administrar'),
    validar({ params: esquemaIds.partial({ rolId: true }), body: esquemaAsignarRol }),
    async (req, res, next) => {
      try {
        const resultado = await asignarRol(req.params.id, req.body, ctxDe(req));
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
    exigirPermiso('usuarios:administrar'),
    validar({ params: esquemaIds, body: z.object({ autorizacionId: z.coerce.number().int().positive().optional() }).optional() }),
    async (req, res, next) => {
      try {
        const resultado = await quitarRol(req.params.id, req.params.rolId, {
          ...ctxDe(req),
          autorizacionId: req.body?.autorizacionId,
        });
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
    exigirPermiso('usuarios:administrar'),
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

  // ── Ciclo de autorizacion de roles elevados (Anexo sec. 3) ──

  router.get(
    '/autorizaciones-rol',
    // 'autorizaciones:decidir' identifica a DIRECCION, autorizador del anexo.
    exigirCualquiera('usuarios:administrar', 'autorizaciones:decidir', 'solicitudes:revisar'),
    async (_req, res, next) => {
      try {
        res.json(await listarAutorizaciones(ctx));
      } catch (error) {
        next(error);
      }
    }
  );

  router.post('/autorizaciones-rol', validar({ body: esquemaSolicitud }), async (req, res, next) => {
    try {
      // La matriz del anexo valida aqui quien puede solicitar cada rol.
      res.status(201).json(await solicitarAutorizacion(req.body, ctxDe(req)));
    } catch (error) {
      next(error);
    }
  });

  router.post(
    '/autorizaciones-rol/:id/decision',
    validar({ params: esquemaIds.partial({ rolId: true }), body: esquemaDecision }),
    async (req, res, next) => {
      try {
        const resultado = await decidirAutorizacion(req.params.id, req.body, ctxDe(req));
        await prisma.auditoria.create({
          data: {
            usuarioId: req.user.id,
            entidad: 'AutorizacionRol',
            entidadId: req.params.id,
            accion: 'DECIDIR_AUTORIZACION_ROL',
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

  return router;
}

module.exports = { rutasAdminUsuarios };
