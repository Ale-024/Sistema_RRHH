const express = require('express');
const { registrarMarcaje } = require('../application/registrar-marcaje.usecase');
const { consultaAsistencia } = require('./esquemas');
const validar = require('../../../shared/http/validar');
const { exigirPermiso } = require('../../../shared/http/autorizacion');
const {
  aplicarAlcanceRelacion,
} = require('../../../shared/dominio/alcance');

/**
 * Rutas del modulo asistencia.
 * Contrato MVP: /api/employee/attendance y /api/admin/attendance.
 */
function rutasEmpleado(ctx) {
  const { prisma, clock } = ctx;
  const router = express.Router();

  router.post('/attendance', async (req, res, next) => {
    try {
      res.json(await registrarMarcaje(req.user.empleado_id, clock.ahora(), ctx));
    } catch (error) {
      next(error);
    }
  });

  router.get(
    '/attendance',
    validar({ query: consultaAsistencia }),
    async (req, res, next) => {
      try {
        const { desde, hasta } = req.query;
        res.json(
          await prisma.asistencia.findMany({
            where: {
              empleado_id: req.user.empleado_id,
              ...(desde || hasta
                ? {
                    fecha_hora_entrada: {
                      ...(desde ? { gte: desde } : {}),
                      ...(hasta ? { lte: hasta } : {}),
                    },
                  }
                : {}),
            },
            orderBy: { fecha_hora_entrada: 'desc' },
          })
        );
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}

function rutasAdmin(ctx) {
  const { prisma } = ctx;
  const router = express.Router();

  router.get(
    '/attendance',
    exigirPermiso('asistencia:leer_global'),
    validar({ query: consultaAsistencia }),
    async (req, res, next) => {
      try {
        const { desde, hasta } = req.query;
        res.json(
          await prisma.asistencia.findMany({
            where: aplicarAlcanceRelacion('empleado', {
              ...(desde || hasta
                ? {
                    fecha_hora_entrada: {
                      ...(desde ? { gte: desde } : {}),
                      ...(hasta ? { lte: hasta } : {}),
                    },
                  }
                : {}),
            }, req.contexto),
            include: { empleado: { include: { puesto: { include: { departamento: true } } } } },
            orderBy: { fecha_hora_entrada: 'desc' },
          })
        );
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}

module.exports = { rutasEmpleado, rutasAdmin };
