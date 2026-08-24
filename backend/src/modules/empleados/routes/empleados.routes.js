const express = require('express');
const {
  actualizarPerfil,
  cambiarPassword,
  crearEmpleado,
  actualizarEmpleado,
  desactivarEmpleado,
} = require('../application/empleados.usecase');
const {
  actualizarPerfil: esquemaPerfil,
  cambiarPassword: esquemaPassword,
  crearEmpleado: esquemaCrear,
  actualizarEmpleado: esquemaActualizar,
  idNumerico,
} = require('./esquemas');
const validar = require('../../../shared/http/validar');
const { ErrorAplicacion } = require('../../../shared/dominio/errores');

/**
 * Rutas de autoservicio del empleado (perfil). Contrato MVP: /api/employee/profile.
 */
function rutasEmpleado(ctx) {
  const { prisma } = ctx;
  const router = express.Router();

  router.get('/profile', async (req, res, next) => {
    try {
      const empleado = await prisma.empleado.findUnique({
        where: { id: req.user.empleado_id },
        include: { puesto: { include: { departamento: true } } },
      });
      if (!empleado) {
        throw new ErrorAplicacion('NO_ENCONTRADO', 404, 'Empleado no encontrado.');
      }
      res.json(empleado);
    } catch (error) {
      next(error);
    }
  });

  router.put(
    '/profile',
    validar({ body: esquemaPerfil }),
    async (req, res, next) => {
      try {
        res.json(await actualizarPerfil(req.user.empleado_id, req.body, ctx));
      } catch (error) {
        next(error);
      }
    }
  );

  router.put(
    '/profile/password',
    validar({ body: esquemaPassword }),
    async (req, res, next) => {
      try {
        res.json(
          await cambiarPassword(
            req.user.id,
            req.body.currentPassword,
            req.body.newPassword,
            ctx
          )
        );
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}

/**
 * Rutas de administracion de empleados. Contrato MVP: /api/admin/employees.
 */
function rutasAdminEmpleados(ctx) {
  const { prisma } = ctx;
  const router = express.Router();

  router.get('/employees', async (_req, res, next) => {
    try {
      res.json(
        await prisma.empleado.findMany({
          include: {
            usuario: { select: { email: true, rol: true, activo: true } },
            puesto: { include: { departamento: true } },
          },
        })
      );
    } catch (error) {
      next(error);
    }
  });

  router.post('/employees', validar({ body: esquemaCrear }), async (req, res, next) => {
    try {
      const newUser = await crearEmpleado(req.body, ctx);
      res.json({ message: 'Empleado creado', data: newUser });
    } catch (error) {
      next(error);
    }
  });

  router.put(
    '/employees/:id',
    validar({ params: idNumerico, body: esquemaActualizar }),
    async (req, res, next) => {
      try {
        res.json(await actualizarEmpleado(req.params.id, req.body, ctx));
      } catch (error) {
        next(error);
      }
    }
  );

  router.put(
    '/employees/:id/deactivate',
    validar({ params: idNumerico }),
    async (req, res, next) => {
      try {
        res.json(await desactivarEmpleado(req.params.id, ctx));
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}

module.exports = { rutasEmpleado, rutasAdminEmpleados };
