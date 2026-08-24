const express = require('express');
const { z } = require('zod');
const { registrarSuscriptores } = require('./application/auditoria.service');
const { verificarToken, cargarPermisos } = require('../iam/application/autenticacion');
const { exigirPermiso } = require('../../shared/http/autorizacion');
const validar = require('../../shared/http/validar');

const esquemaConsulta = z.object({
  entidad: z.string().trim().max(60).optional(),
  usuarioId: z.coerce.number().int().positive().optional(),
  desde: z.coerce.date().optional(),
  hasta: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  size: z.coerce.number().int().positive().max(100).default(50),
});

/**
 * Consulta de la bitacora (permiso auditoria:leer).
 * Montaje: /api/admin/auditoria.
 */
function rutasAdminAuditoria(ctx) {
  const router = express.Router();
  router.use(verificarToken, cargarPermisos, exigirPermiso('auditoria:leer'));

  router.get('/auditoria', validar({ query: esquemaConsulta }), async (req, res, next) => {
    try {
      const { entidad, usuarioId, desde, hasta, page, size } = req.query;
      const where = {
        ...(entidad ? { entidad } : {}),
        ...(usuarioId ? { usuarioId } : {}),
        ...(desde || hasta
          ? { ocurridoEn: { ...(desde ? { gte: desde } : {}), ...(hasta ? { lte: hasta } : {}) } }
          : {}),
      };
      const [total, registros] = await Promise.all([
        ctx.prisma.auditoria.count({ where }),
        ctx.prisma.auditoria.findMany({
          where,
          orderBy: { ocurridoEn: 'desc' },
          skip: (page - 1) * size,
          take: size,
        }),
      ]);
      res.json({ total, page, size, registros });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { rutasAdminAuditoria, registrarSuscriptores };
