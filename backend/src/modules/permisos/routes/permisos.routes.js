const express = require('express');
const {
  crearSolicitud,
  cambiarEstado,
  idNumerico,
} = require('./esquemas');
const validar = require('../../../shared/http/validar');
const { exigirPermiso } = require('../../../shared/http/autorizacion');
const {
  aplicarAlcanceRelacion,
} = require('../../../shared/dominio/alcance');
const { ErrorAplicacion } = require('../../../shared/dominio/errores');

/**
 * Rutas del modulo permisos.
 * Contrato MVP: /api/employee/requests y /api/admin/requests.
 * La FSM completa del documento llega en la Fase 4; aqui se conserva
 * el comportamiento vigente con validacion de entrada.
 */
function rutasEmpleado(ctx) {
  const { prisma, bus } = ctx;
  const router = express.Router();

  router.post('/requests', validar({ body: crearSolicitud }), async (req, res, next) => {
    try {
      const solicitud = await prisma.solicitud.create({
        data: {
          empleado_id: req.user.empleado_id,
          tipo: req.body.tipo,
          fecha_inicio: req.body.fecha_inicio,
          fecha_fin: req.body.fecha_fin,
          motivo: req.body.motivo,
          estado: 'PENDIENTE',
        },
      });
      bus.publicar('SolicitudCreada', { solicitudId: solicitud.id });
      res.json({ message: 'Solicitud creada exitosamente', data: solicitud });
    } catch (error) {
      next(error);
    }
  });

  router.get('/requests', async (req, res, next) => {
    try {
      res.json(
        await prisma.solicitud.findMany({
          where: { empleado_id: req.user.empleado_id },
          orderBy: { fecha_solicitud: 'desc' },
        })
      );
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function rutasAdmin(ctx) {
  const { prisma } = ctx;
  const router = express.Router();

  router.get(
    '/requests',
    exigirPermiso('solicitudes:leer_global'),
    async (req, res, next) => {
      try {
        res.json(
          await prisma.solicitud.findMany({
            where: aplicarAlcanceRelacion('empleado', {}, req.contexto),
            include: { empleado: { include: { puesto: { include: { departamento: true } } } } },
            orderBy: { fecha_solicitud: 'desc' },
          })
        );
      } catch (error) {
        next(error);
      }
    }
  );

  router.put(
    '/requests/:id/status',
    exigirPermiso('solicitudes:revisar'),
    validar({ params: idNumerico, body: cambiarEstado }),
    async (req, res, next) => {
      try {
        const actual = await prisma.solicitud.findUnique({
          where: { id: req.params.id },
        });
        if (!actual) {
          throw new ErrorAplicacion('NO_ENCONTRADO', 404, 'Solicitud no encontrada.');
        }
        if (actual.estado !== 'PENDIENTE') {
          throw new ErrorAplicacion(
            'CONFLICTO_ESTADO',
            409,
            `La solicitud ya fue ${actual.estado.toLowerCase()}. No puede modificarse.`
          );
        }

        const request = await prisma.solicitud.update({
          where: { id: req.params.id },
          data: { estado: req.body.estado },
        });

        await prisma.notificacion.create({
          data: {
            empleado_id: request.empleado_id,
            mensaje: `Tu solicitud de ${request.tipo} ha sido ${request.estado}.`,
          },
        });

        res.json(request);
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}

module.exports = { rutasEmpleado, rutasAdmin };
