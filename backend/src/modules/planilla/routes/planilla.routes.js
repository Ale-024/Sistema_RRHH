const express = require('express');
const { crearNomina, actualizarNomina, idNumerico } = require('./esquemas');
const validar = require('../../../shared/http/validar');

/**
 * Rutas del modulo planilla (modelo Nomina del MVP).
 * La Fase 6 lo reemplaza por PeriodoPlanilla/DetallePlanilla con el
 * motor puro y la inmutabilidad del cierre.
 */
function rutasEmpleado(ctx) {
  const { prisma } = ctx;
  const router = express.Router();

  router.get('/payroll', async (req, res, next) => {
    try {
      res.json(
        await prisma.nomina.findMany({
          where: { empleado_id: req.user.empleado_id },
          orderBy: { periodo_inicio: 'desc' },
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

  router.get('/payroll', async (_req, res, next) => {
    try {
      res.json(
        await prisma.nomina.findMany({
          include: { empleado: true },
          orderBy: { periodo_inicio: 'desc' },
        })
      );
    } catch (error) {
      next(error);
    }
  });

  router.post('/payroll', validar({ body: crearNomina }), async (req, res, next) => {
    try {
      const neto = req.body.salario_bruto - req.body.deducciones;
      res.json(
        await prisma.nomina.create({
          data: { ...req.body, salario_neto: neto },
        })
      );
    } catch (error) {
      next(error);
    }
  });

  router.put(
    '/payroll/:id',
    validar({ params: idNumerico, body: actualizarNomina }),
    async (req, res, next) => {
      try {
        const actual = await prisma.nomina.findUnique({
          where: { id: req.params.id },
        });
        const bruto = req.body.salario_bruto ?? Number(actual.salario_bruto);
        const deducciones = req.body.deducciones ?? Number(actual.deducciones);
        if (deducciones > bruto) {
          return res.status(400).json({
            message: 'Las deducciones no pueden superar el salario bruto.',
          });
        }
        res.json(
          await prisma.nomina.update({
            where: { id: req.params.id },
            data: { ...req.body, salario_neto: bruto - deducciones },
          })
        );
      } catch (error) {
        next(error);
      }
    }
  );

  router.delete(
    '/payroll/:id',
    validar({ params: idNumerico }),
    async (req, res, next) => {
      try {
        await prisma.nomina.delete({ where: { id: req.params.id } });
        res.json({ message: 'Nomina eliminada' });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}

module.exports = { rutasEmpleado, rutasAdmin };
