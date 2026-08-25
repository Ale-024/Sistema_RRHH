const express = require('express');
const {
  cambiarEstadoVacacion,
  crearSolicitudVacacion,
  devengarVacaciones,
  opcionesSolicitud,
} = require('../application/vacaciones.usecase');
const esquemas = require('./esquemas');
const validar = require('../../../shared/http/validar');
const { exigirPermiso } = require('../../../shared/http/autorizacion');
const { aplicarAlcanceRelacion } = require('../../../shared/dominio/alcance');
const { ErrorAplicacion } = require('../../../shared/dominio/errores');

function publicarCambio(bus, solicitud, evento, usuarioId) {
  bus.publicar(evento, {
    vacacionId: solicitud.id,
    folio: solicitud.folio,
    empleadoId: solicitud.empleadoId,
    usuarioId,
    estado: solicitud.estado,
  });
}

async function obtenerPropia(prisma, id, empleadoId) {
  const solicitud = await prisma.solicitudVacacion.findFirst({ where: { id, empleadoId }, include: opcionesSolicitud() });
  if (!solicitud) throw new ErrorAplicacion('NO_ENCONTRADO', 404, 'Solicitud de vacaciones no encontrada.');
  return solicitud;
}

function rutasEmpleado(ctx) {
  const { prisma, bus } = ctx;
  const router = express.Router();

  // Devengo perezoso e idempotente: garantiza que el empleado tenga sus
  // periodos/saldos aunque el cron nocturno no haya corrido (free tier).
  async function asegurarDevengo(empleadoId) {
    try {
      await devengarVacaciones({ prisma, empleadoId });
    } catch (error) {
      console.error('[vacaciones] Devengo perezoso fallo:', error.message);
    }
  }

  router.get('/vacaciones/saldos', exigirPermiso('vacaciones:leer'), async (req, res, next) => {
    try {
      await asegurarDevengo(req.user.empleado_id);
      const periodos = await prisma.periodoVacacional.findMany({ where: { empleadoId: req.user.empleado_id }, include: { movimientos: true }, orderBy: { hasta: 'desc' } });
      res.json(periodos.map((periodo) => ({ ...periodo, saldo: periodo.movimientos.reduce((total, movimiento) => total + movimiento.dias, 0) })));
    } catch (error) { next(error); }
  });

  router.get('/vacaciones/solicitudes', exigirPermiso('vacaciones:leer'), async (req, res, next) => {
    try {
      res.json(await prisma.solicitudVacacion.findMany({ where: { empleadoId: req.user.empleado_id }, include: opcionesSolicitud(), orderBy: { creadoEn: 'desc' } }));
    } catch (error) { next(error); }
  });

  router.post('/vacaciones/solicitudes', exigirPermiso('vacaciones:crear'), validar({ body: esquemas.crearSolicitud }), async (req, res, next) => {
    try {
      const solicitud = await crearSolicitudVacacion({ prisma, empleadoId: req.user.empleado_id, usuarioId: req.user.id, datos: req.body, ip: req.ip });
      publicarCambio(bus, solicitud, 'VacacionSolicitada', req.user.id);
      res.status(201).json({ data: solicitud });
    } catch (error) { next(error); }
  });

  async function enviar(req, res, next, destino) {
    try {
      await obtenerPropia(prisma, req.params.id, req.user.empleado_id);
      const solicitud = await cambiarEstadoVacacion({ prisma, id: req.params.id, destino, usuarioId: req.user.id, motivo: req.body.motivo, ip: req.ip });
      publicarCambio(bus, solicitud, destino === 'EN_REVISION' ? 'VacacionEnviadaRevision' : 'VacacionCancelada', req.user.id);
      res.json({ data: solicitud });
    } catch (error) { next(error); }
  }

  router.post('/vacaciones/solicitudes/:id/enviar', exigirPermiso('vacaciones:crear'), validar({ params: esquemas.idNumerico, body: esquemas.motivoOpcional }), (req, res, next) => enviar(req, res, next, 'EN_REVISION'));
  router.post('/vacaciones/solicitudes/:id/cancelar', exigirPermiso('vacaciones:crear'), validar({ params: esquemas.idNumerico, body: esquemas.motivoOpcional }), (req, res, next) => enviar(req, res, next, 'CANCELADO'));
  return router;
}

function rutasAdmin(ctx) {
  const { prisma, bus } = ctx;
  const router = express.Router();

  router.get('/vacaciones/solicitudes', exigirPermiso('vacaciones:leer_global'), validar({ query: esquemas.consulta }), async (req, res, next) => {
    try {
      const where = req.query.estado ? { estado: req.query.estado } : {};
      res.json(await prisma.solicitudVacacion.findMany({ where: aplicarAlcanceRelacion('empleado', where, req.contexto), include: { ...opcionesSolicitud(), empleado: { include: { puesto: { include: { departamento: true } } } } }, orderBy: { creadoEn: 'desc' } }));
    } catch (error) { next(error); }
  });

  async function cambiar(req, res, next, destino, requiereMotivo) {
    try {
      if (requiereMotivo) esquemas.motivoRequerido.parse(req.body ?? {});
      const solicitud = await cambiarEstadoVacacion({ prisma, id: req.params.id, destino, usuarioId: req.user.id, motivo: req.body?.motivo, ip: req.ip });
      const eventos = { APROBADO: 'VacacionAprobada', RECHAZADO: 'VacacionRechazada', SOLICITADO: 'VacacionCorreccionSolicitada' };
      publicarCambio(bus, solicitud, eventos[destino], req.user.id);
      res.json({ data: solicitud });
    } catch (error) { next(error); }
  }

  router.post('/vacaciones/solicitudes/:id/aprobar', exigirPermiso('vacaciones:aprobar'), validar({ params: esquemas.idNumerico, body: esquemas.motivoOpcional }), (req, res, next) => cambiar(req, res, next, 'APROBADO', false));
  router.post('/vacaciones/solicitudes/:id/rechazar', exigirPermiso('vacaciones:aprobar'), validar({ params: esquemas.idNumerico, body: esquemas.motivoRequerido }), (req, res, next) => cambiar(req, res, next, 'RECHAZADO', true));
  router.post('/vacaciones/solicitudes/:id/solicitar-correccion', exigirPermiso('vacaciones:aprobar'), validar({ params: esquemas.idNumerico, body: esquemas.motivoRequerido }), (req, res, next) => cambiar(req, res, next, 'SOLICITADO', true));
  return router;
}

module.exports = { rutasAdmin, rutasEmpleado };
