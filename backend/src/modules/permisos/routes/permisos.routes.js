const express = require('express');
const {
  actualizarSolicitud,
  cambiarEstado,
  crearSolicitud,
} = require('../application/permisos.usecase');
const esquemas = require('./esquemas');
// Los esquemas de validacion viven SOLO en ./esquemas; el usecase nunca los
// exporto y usarlos desestructurados desde ahi era undefined silencioso.
const validar = require('../../../shared/http/validar');
const { exigirPermiso } = require('../../../shared/http/autorizacion');
const { aplicarAlcanceRelacion } = require('../../../shared/dominio/alcance');
const { ErrorAplicacion } = require('../../../shared/dominio/errores');

function opcionesSolicitud() {
  return {
    tipoPermiso: true,
    historial: { orderBy: { ocurridoEn: 'asc' } },
  };
}

async function obtenerSolicitudPropia(prisma, id, empleadoId) {
  const solicitud = await prisma.solicitudPermiso.findFirst({
    where: { id, empleadoId },
    include: opcionesSolicitud(),
  });
  if (!solicitud) {
    throw new ErrorAplicacion('NO_ENCONTRADO', 404, 'Solicitud de permiso no encontrada.');
  }
  return solicitud;
}

function publicarCambio(bus, solicitud, evento, usuarioId) {
  bus.publicar(evento, {
    permisoId: solicitud.id,
    folio: solicitud.folio,
    empleadoId: solicitud.empleadoId,
    usuarioId,
    estado: solicitud.estado,
  });
}

function rutasEmpleado(ctx) {
  const { prisma, bus } = ctx;
  const router = express.Router();

  router.get('/requests/types', exigirPermiso('solicitudes:crear'), async (_req, res, next) => {
    try {
      res.json(await prisma.tipoPermiso.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } }));
    } catch (error) {
      next(error);
    }
  });

  router.post(
    '/requests',
    exigirPermiso('solicitudes:crear'),
    validar({ body: esquemas.crearSolicitud }),
    async (req, res, next) => {
      try {
        const solicitud = await crearSolicitud({
          prisma,
          empleadoId: req.user.empleado_id,
          usuarioId: req.user.id,
          datos: req.body,
          ip: req.ip,
        });
        publicarCambio(bus, solicitud, 'PermisoSolicitado', req.user.id);
        res.status(201).json({ data: solicitud });
      } catch (error) {
        next(error);
      }
    }
  );

  router.get('/requests', async (req, res, next) => {
    try {
      res.json(
        await prisma.solicitudPermiso.findMany({
          where: { empleadoId: req.user.empleado_id },
          include: opcionesSolicitud(),
          orderBy: { creadoEn: 'desc' },
        })
      );
    } catch (error) {
      next(error);
    }
  });

  router.put(
    '/requests/:id',
    validar({ params: esquemas.idNumerico, body: esquemas.actualizarSolicitud }),
    async (req, res, next) => {
      try {
        const solicitud = await actualizarSolicitud({
          prisma,
          id: Number(req.params.id),
          empleadoId: req.user.empleado_id,
          datos: req.body,
        });
        res.json({ data: solicitud });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/requests/:id/enviar',
    validar({ params: esquemas.idNumerico, body: esquemas.motivoOpcional }),
    async (req, res, next) => {
      try {
        await obtenerSolicitudPropia(prisma, Number(req.params.id), req.user.empleado_id);
        const solicitud = await cambiarEstado({
          prisma,
          id: Number(req.params.id),
          destino: 'EN_REVISION',
          usuarioId: req.user.id,
          motivo: req.body.motivo,
          ip: req.ip,
        });
        publicarCambio(bus, solicitud, 'PermisoEnviadoRevision', req.user.id);
        res.json({ data: solicitud });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/requests/:id/cancelar',
    validar({ params: esquemas.idNumerico, body: esquemas.motivoOpcional }),
    async (req, res, next) => {
      try {
        await obtenerSolicitudPropia(prisma, Number(req.params.id), req.user.empleado_id);
        const solicitud = await cambiarEstado({
          prisma,
          id: Number(req.params.id),
          destino: 'CANCELADO',
          usuarioId: req.user.id,
          motivo: req.body.motivo,
          ip: req.ip,
        });
        publicarCambio(bus, solicitud, 'PermisoCancelado', req.user.id);
        res.json({ data: solicitud });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}

function rutasAdmin(ctx) {
  const { prisma, bus } = ctx;
  const router = express.Router();

  router.get(
    '/requests',
    exigirPermiso('solicitudes:leer_global'),
    validar({ query: esquemas.consulta }),
    async (req, res, next) => {
      try {
        const whereBase = req.query.estado ? { estado: req.query.estado } : {};
        res.json(
          await prisma.solicitudPermiso.findMany({
            where: aplicarAlcanceRelacion('empleado', whereBase, req.contexto),
            include: {
              ...opcionesSolicitud(),
              empleado: { include: { puesto: { include: { departamento: true } } } },
            },
            orderBy: { creadoEn: 'desc' },
          })
        );
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/requests/:id/aprobar',
    exigirPermiso('permisos:aprobar'),
    validar({ params: esquemas.idNumerico, body: esquemas.motivoOpcional }),
    async (req, res, next) => {
      try {
        const solicitud = await cambiarEstado({
          prisma,
          id: Number(req.params.id),
          destino: 'APROBADO',
          usuarioId: req.user.id,
          motivo: req.body.motivo,
          ip: req.ip,
        });
        publicarCambio(bus, solicitud, 'PermisoAprobado', req.user.id);
        res.json({ data: solicitud });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/requests/:id/rechazar',
    exigirPermiso('permisos:aprobar'),
    validar({ params: esquemas.idNumerico, body: esquemas.motivoRequerido }),
    async (req, res, next) => {
      try {
        const solicitud = await cambiarEstado({
          prisma,
          id: Number(req.params.id),
          destino: 'RECHAZADO',
          usuarioId: req.user.id,
          motivo: req.body.motivo,
          ip: req.ip,
        });
        publicarCambio(bus, solicitud, 'PermisoRechazado', req.user.id);
        res.json({ data: solicitud });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/requests/:id/solicitar-correccion',
    exigirPermiso('permisos:aprobar'),
    validar({ params: esquemas.idNumerico, body: esquemas.motivoRequerido }),
    async (req, res, next) => {
      try {
        const solicitud = await cambiarEstado({
          prisma,
          id: Number(req.params.id),
          destino: 'SOLICITADO',
          usuarioId: req.user.id,
          motivo: req.body.motivo,
          ip: req.ip,
        });
        publicarCambio(bus, solicitud, 'PermisoCorreccionSolicitada', req.user.id);
        res.json({ data: solicitud });
      } catch (error) {
        next(error);
      }
    }
  );

  // Adaptador temporal para clientes del MVP. Traduce APROBADA/RECHAZADA
  // a la FSM nueva, sin permitir escrituras directas de estado.
  router.put(
    '/requests/:id/status',
    exigirPermiso('permisos:aprobar'),
    validar({ params: esquemas.idNumerico, body: esquemas.cambiarEstado }),
    async (req, res, next) => {
      try {
        const destino = req.body.estado;
        const solicitud = await cambiarEstado({
          prisma,
          id: Number(req.params.id),
          destino,
          usuarioId: req.user.id,
          ip: req.ip,
        });
        publicarCambio(
          bus,
          solicitud,
          destino === 'APROBADO' ? 'PermisoAprobado' : 'PermisoRechazado',
          req.user.id
        );
        res.json(solicitud);
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}

module.exports = { rutasEmpleado, rutasAdmin };
