const express = require('express');
const {
  crearEmpleado,
  actualizarEmpleado,
  desactivarEmpleado,
  desvincularEmpleado,
  crearContrato,
  listarEmpleados,
  obtenerPerfil,
} = require('../application/empleados.usecase');
const {
  actualizarPerfil: esquemaPerfil,
  cambiarPassword: esquemaPasswordLegacy,
  crearEmpleado: esquemaCrear,
  actualizarEmpleado: esquemaActualizar,
  desvincular: esquemaDesvincular,
  crearContrato: esquemaContrato,
  idNumerico,
} = require('./esquemas');
const validar = require('../../../shared/http/validar');
const { exigirPermiso } = require('../../../shared/http/autorizacion');
const { ErrorAplicacion } = require('../../../shared/dominio/errores');

/**
 * Contexto de autorizacion plano para la capa de aplicacion.
 */
function contextoDe(req) {
  return {
    usuarioId: req.user?.id,
    permisos: req.contexto?.permisos,
    scopeDepartamentos: req.contexto?.scopeDepartamentos,
    ip: req.ip,
    requestId: req.contexto?.requestId,
  };
}

/**
 * Rutas de autoservicio del empleado (perfil). Contrato MVP:
 * /api/employee/profile. Requieren autenticacion; el perfil propio
 * no exige permisos adicionales.
 */
function rutasEmpleado(ctx) {
  const router = express.Router();

  router.get('/profile', async (req, res, next) => {
    try {
      if (!req.user.empleado_id) {
        throw new ErrorAplicacion('SIN_EMPLEADO', 404, 'El usuario no tiene expediente de empleado.');
      }
      res.json(await obtenerPerfil(req.user.empleado_id, ctx));
    } catch (error) {
      next(error);
    }
  });

  router.put(
    '/profile',
    validar({ body: esquemaPerfil }),
    async (req, res, next) => {
      try {
        const { numeroIhss, cuentaBancaria, ...resto } = req.body;
        const data = {
          ...resto,
          ...(numeroIhss !== undefined
            ? { numero_ihss_cif: ctx.cifrador.cifrar(numeroIhss) }
            : {}),
          ...(cuentaBancaria !== undefined
            ? { cuenta_bancaria_cif: ctx.cifrador.cifrar(cuentaBancaria) }
            : {}),
        };
        const empleado = await ctx.prisma.empleado.update({
          where: { id: req.user.empleado_id },
          data,
        });
        res.json(empleadoPublicoSeguro(empleado, ctx));
      } catch (error) {
        next(error);
      }
    }
  );

  // Cambio de contrasena desde el perfil (contrato MVP conservado).
  router.put(
    '/profile/password',
    validar({ body: esquemaPasswordLegacy }),
    async (req, res, next) => {
      try {
        const { cambiarPassword } = require('../../iam/iam.module');
        res.json(
          await cambiarPassword(req.user.id, req.body.currentPassword, req.body.newPassword, {
            ...ctx,
            bus: ctx.bus,
          })
        );
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}

function empleadoPublicoSeguro(empleado, ctx) {
  const { empleadoPublico } = require('../application/empleados.usecase');
  return empleadoPublico(empleado, ctx.cifrador);
}

/**
 * Rutas de administracion de empleados. Contrato MVP: /api/admin/employees.
 * Cada ruta exige su permiso granular.
 */
function rutasAdminEmpleados(ctx) {
  const router = express.Router();

  router.get(
    '/employees',
    exigirPermiso('empleados:leer'),
    async (req, res, next) => {
      try {
        res.json(await listarEmpleados(contextoDe(req), ctx));
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/employees',
    exigirPermiso('empleados:crear'),
    validar({ body: esquemaCrear }),
    async (req, res, next) => {
      try {
        const resultado = await crearEmpleado(req.body, ctx);
        res.json({ message: 'Empleado creado', data: resultado.usuario.id });
      } catch (error) {
        next(error);
      }
    }
  );

  router.put(
    '/employees/:id',
    exigirPermiso('empleados:actualizar'),
    validar({ params: idNumerico, body: esquemaActualizar }),
    async (req, res, next) => {
      try {
        res.json(await actualizarEmpleado(req.params.id, req.body, contextoDe(req), ctx));
      } catch (error) {
        next(error);
      }
    }
  );

  router.put(
    '/employees/:id/deactivate',
    exigirPermiso('empleados:actualizar'),
    validar({ params: idNumerico }),
    async (req, res, next) => {
      try {
        res.json(await desactivarEmpleado(req.params.id, contextoDe(req), ctx));
      } catch (error) {
        next(error);
      }
    }
  );

  router.put(
    '/employees/:id/desvincular',
    exigirPermiso('empleados:desvincular'),
    validar({ params: idNumerico, body: esquemaDesvincular }),
    async (req, res, next) => {
      try {
        res.json(await desvincularEmpleado(req.params.id, req.body, contextoDe(req), ctx));
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/employees/:id/contratos',
    exigirPermiso('contratos:crear'),
    validar({ params: idNumerico, body: esquemaContrato }),
    async (req, res, next) => {
      try {
        res.json(await crearContrato(req.params.id, req.body, contextoDe(req), ctx));
      } catch (error) {
        next(error);
      }
    }
  );

  router.get(
    '/employees/:id/contratos',
    exigirPermiso('empleados:leer'),
    validar({ params: idNumerico }),
    async (req, res, next) => {
      try {
        res.json(
          await ctx.prisma.contrato.findMany({
            where: { empleado_id: req.params.id },
            orderBy: { vigenciaDesde: 'desc' },
          })
        );
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}

module.exports = { rutasEmpleado, rutasAdminEmpleados };
