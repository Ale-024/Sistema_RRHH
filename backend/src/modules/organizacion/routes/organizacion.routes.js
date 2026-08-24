const express = require('express');
const { crearDepartamento, crearPuesto } = require('./esquemas');
const validar = require('../../../shared/http/validar');
const { exigirPermiso } = require('../../../shared/http/autorizacion');

/**
 * Rutas de administracion del modulo organizacion (catalogos).
 * Se montan bajo /api/admin conservando el contrato del MVP.
 * La escritura exige organizacion:administrar.
 */
function rutasAdminOrganizacion(ctx) {
  const { prisma } = ctx;
  const router = express.Router();

  router.get('/departments', async (_req, res, next) => {
    try {
      res.json(await prisma.departamento.findMany());
    } catch (error) {
      next(error);
    }
  });

  router.post(
    '/departments',
    exigirPermiso('organizacion:administrar'),
    validar({ body: crearDepartamento }),
    async (req, res, next) => {
      try {
        res.json(await prisma.departamento.create({ data: req.body }));
      } catch (error) {
        next(error);
      }
    }
  );

  router.get('/positions', async (_req, res, next) => {
    try {
      res.json(
        await prisma.puesto.findMany({ include: { departamento: true } })
      );
    } catch (error) {
      next(error);
    }
  });

  router.post(
    '/positions',
    exigirPermiso('organizacion:administrar'),
    validar({ body: crearPuesto }),
    async (req, res, next) => {
      try {
        res.json(await prisma.puesto.create({ data: req.body }));
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}

module.exports = { rutasAdminOrganizacion };
