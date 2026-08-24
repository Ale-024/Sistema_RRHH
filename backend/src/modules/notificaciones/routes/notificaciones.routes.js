const express = require('express');
const { idNumerico } = require('./esquemas');
const validar = require('../../../shared/http/validar');
const { ErrorAplicacion } = require('../../../shared/dominio/errores');

/**
 * Rutas del modulo notificaciones. Contrato MVP: /api/employee/notifications.
 * Correccion de seguridad: solo el propietario puede marcar su notificacion.
 */
function rutasEmpleado(ctx) {
  const { prisma } = ctx;
  const router = express.Router();

  router.get('/notifications', async (req, res, next) => {
    try {
      res.json(
        await prisma.notificacion.findMany({
          where: { empleado_id: req.user.empleado_id },
          orderBy: { fecha_creacion: 'desc' },
        })
      );
    } catch (error) {
      next(error);
    }
  });

  router.put(
    '/notifications/:id/read',
    validar({ params: idNumerico }),
    async (req, res, next) => {
      try {
        const notif = await prisma.notificacion.findUnique({
          where: { id: req.params.id },
        });
        if (!notif) {
          throw new ErrorAplicacion('NO_ENCONTRADO', 404, 'Notificacion no encontrada.');
        }
        if (notif.empleado_id !== req.user.empleado_id) {
          throw new ErrorAplicacion(
            'PERMISO_DENEGADO',
            403,
            'No es propietario de esta notificacion.'
          );
        }
        res.json(await prisma.notificacion.update({
          where: { id: req.params.id },
          data: { leida: true },
        }));
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}

module.exports = { rutasEmpleado };
