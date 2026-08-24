const express = require('express');
const { calcularPeriodoPlanilla, crearPeriodoAjuste, crearPeriodoPlanilla, obtenerPeriodo, transicionarPeriodo } = require('../application/planilla.usecase');
const { crearReciboPdf } = require('../application/recibo-pdf');
const esquemas = require('./esquemas');
const validar = require('../../../shared/http/validar');
const { exigirPermiso } = require('../../../shared/http/autorizacion');
const { ErrorAplicacion } = require('../../../shared/dominio/errores');

function publicar(bus, periodo, evento, usuarioId) {
  bus.publicar(evento, { periodoId: periodo.id, codigo: periodo.codigo, usuarioId, estado: periodo.estado });
}

async function detallePropio(prisma, id, empleadoId) {
  const detalle = await prisma.detallePlanilla.findFirst({ where: { id, empleadoId }, include: { empleado: true, periodo: true, lineas: { include: { concepto: true } } } });
  if (!detalle) throw new ErrorAplicacion('NO_ENCONTRADO', 404, 'Recibo de planilla no encontrado.');
  return detalle;
}

function enviarPdf(res, detalle) {
  res.type('application/pdf').set('Content-Disposition', `inline; filename="recibo-${detalle.periodo.codigo}-${detalle.empleado.dni}.pdf"`).send(crearReciboPdf(detalle));
}

function rutasEmpleado(ctx) {
  const { prisma } = ctx;
  const router = express.Router();
  router.get('/payroll', exigirPermiso('planilla:leer'), async (req, res, next) => {
    try {
      res.json(await prisma.periodoPlanilla.findMany({ where: { detalles: { some: { empleadoId: req.user.empleado_id } } }, include: { detalles: { where: { empleadoId: req.user.empleado_id }, include: { lineas: { include: { concepto: true } } } } }, orderBy: { fechaPago: 'desc' } }));
    } catch (error) { next(error); }
  });
  router.get('/payroll/recibos/:id', exigirPermiso('planilla:leer'), validar({ params: esquemas.idNumerico }), async (req, res, next) => {
    try { enviarPdf(res, await detallePropio(prisma, req.params.id, req.user.empleado_id)); } catch (error) { next(error); }
  });
  return router;
}

function rutasAdmin(ctx) {
  const { prisma, bus } = ctx;
  const router = express.Router();
  router.get('/payroll', exigirPermiso('planilla:leer_global'), validar({ query: esquemas.consulta }), async (req, res, next) => {
    try {
      const where = req.query.estado ? { estado: req.query.estado } : {};
      res.json(await prisma.periodoPlanilla.findMany({ where, include: { detalles: { include: { empleado: true, lineas: { include: { concepto: true } } } }, ajustes: true }, orderBy: { fechaPago: 'desc' } }));
    } catch (error) { next(error); }
  });
  router.post('/payroll/periodos', exigirPermiso('planilla:crear'), validar({ body: esquemas.crearPeriodo }), async (req, res, next) => {
    try { const periodo = await crearPeriodoPlanilla({ prisma, datos: req.body, usuarioId: req.user.id }); publicar(bus, periodo, 'PeriodoPlanillaCreado', req.user.id); res.status(201).json({ data: periodo }); } catch (error) { next(error); }
  });
  router.post('/payroll/periodos/:id/calcular', exigirPermiso('planilla:calcular'), validar({ params: esquemas.idNumerico }), async (req, res, next) => {
    try { const periodo = await calcularPeriodoPlanilla({ prisma, periodoId: req.params.id, usuarioId: req.user.id }); publicar(bus, periodo, 'PlanillaCalculada', req.user.id); res.status(202).json({ data: periodo, estado: 'CALCULADA' }); } catch (error) { next(error); }
  });
  router.get('/payroll/periodos/:id', exigirPermiso('planilla:leer_global'), validar({ params: esquemas.idNumerico }), async (req, res, next) => {
    try { res.json(await obtenerPeriodo(prisma, req.params.id)); } catch (error) { next(error); }
  });
  router.get('/payroll/periodos/:id/preliminar', exigirPermiso('planilla:leer_global'), validar({ params: esquemas.idNumerico }), async (req, res, next) => {
    try { res.json(await obtenerPeriodo(prisma, req.params.id)); } catch (error) { next(error); }
  });

  async function cambiar(req, res, next, destino, requiereMotivo = false) {
    try {
      if (requiereMotivo) esquemas.motivoRequerido.parse(req.body ?? {});
      const periodo = await transicionarPeriodo({ prisma, periodoId: req.params.id, destino, usuarioId: req.user.id, motivo: req.body?.motivo });
      const evento = { EN_APROBACION: 'PlanillaEnviadaRevision', CALCULADA: 'PlanillaDevuelta', CERRADA: 'PlanillaCerrada', PAGADA: 'PlanillaPagada' }[destino];
      publicar(bus, periodo, evento, req.user.id);
      res.json({ data: periodo });
    } catch (error) { next(error); }
  }
  router.post('/payroll/periodos/:id/enviar-revision', exigirPermiso('planilla:calcular'), validar({ params: esquemas.idNumerico, body: esquemas.motivoOpcional }), (req, res, next) => cambiar(req, res, next, 'EN_APROBACION'));
  router.post('/payroll/periodos/:id/devolver', exigirPermiso('planilla:cerrar'), validar({ params: esquemas.idNumerico, body: esquemas.motivoRequerido }), (req, res, next) => cambiar(req, res, next, 'CALCULADA', true));
  router.post('/payroll/periodos/:id/cerrar', exigirPermiso('planilla:cerrar'), validar({ params: esquemas.idNumerico, body: esquemas.motivoOpcional }), (req, res, next) => cambiar(req, res, next, 'CERRADA'));
  router.post('/payroll/periodos/:id/registrar-pago', exigirPermiso('planilla:registrar_pago'), validar({ params: esquemas.idNumerico, body: esquemas.motivoOpcional }), (req, res, next) => cambiar(req, res, next, 'PAGADA'));
  router.post('/payroll/periodos/:id/ajuste', exigirPermiso('planilla:crear'), validar({ params: esquemas.idNumerico, body: esquemas.crearAjuste }), async (req, res, next) => {
    try { res.status(201).json({ data: await crearPeriodoAjuste({ prisma, periodoId: req.params.id, usuarioId: req.user.id, datos: req.body }) }); } catch (error) { next(error); }
  });
  router.get('/payroll/recibos/:id', exigirPermiso('planilla:leer_global'), validar({ params: esquemas.idNumerico }), async (req, res, next) => {
    try {
      const detalle = await prisma.detallePlanilla.findUnique({ where: { id: req.params.id }, include: { empleado: true, periodo: true, lineas: { include: { concepto: true } } } });
      if (!detalle) throw new ErrorAplicacion('NO_ENCONTRADO', 404, 'Recibo de planilla no encontrado.');
      enviarPdf(res, detalle);
    } catch (error) { next(error); }
  });
  router.get('/parametros-legales', exigirPermiso('parametros:leer'), async (_req, res, next) => {
    try { res.json(await prisma.parametroLegal.findMany({ orderBy: [{ clave: 'asc' }, { vigenciaDesde: 'desc' }] })); } catch (error) { next(error); }
  });
  router.post('/parametros-legales', exigirPermiso('parametros:administrar'), validar({ body: esquemas.crearParametro }), async (req, res, next) => {
    try { res.status(201).json({ data: await prisma.parametroLegal.create({ data: { ...req.body, creadoPor: req.user.id } }) }); } catch (error) { next(error); }
  });
  return router;
}

module.exports = { rutasAdmin, rutasEmpleado };
