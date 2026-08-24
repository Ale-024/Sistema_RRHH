const express = require('express');
const { z } = require('zod');
const { exigirPermiso } = require('../../shared/http/autorizacion');
const validar = require('../../shared/http/validar');
const { ErrorAplicacion } = require('../../shared/dominio/errores');
const reportes = require('./application/reportes.usecase');
const { refrescarProyecciones, rangoUltimosMeses } = require('./application/proyecciones.usecase');
const { crearPdfReporte, crearXlsx } = require('./application/formatos');

const esquemaConsulta = z.object({
  anio: z.coerce.number().int().min(2000).max(2200).optional(),
  mes: z.coerce.number().int().min(1).max(12).optional(),
  desde: z.coerce.date().optional(),
  hasta: z.coerce.date().optional(),
  formato: z.enum(['json', 'xlsx', 'pdf']).default('json'),
});
const esquemaTexto = z.object({ q: z.string().trim().min(2).max(80) });

function exigirAccesoReportes(req, _res, next) {
  if (!req.contexto?.permisos?.has('reportes:ver') && !req.contexto?.permisos?.has('reportes:ver_global')) {
    return next(new ErrorAplicacion('PERMISO_DENEGADO', 403, 'Se requiere acceso a reportes.'));
  }
  next();
}

function filasPlanillas(filas) {
  return filas.map((fila) => ({
    anio: fila.anio,
    mes: fila.mes,
    departamento: fila.departamento?.nombre,
    empleados: fila.empleados,
    brutoHnl: fila.totalBrutoCent / 100,
    deduccionesHnl: fila.totalDeduccionesCent / 100,
    netoHnl: fila.totalNetoCent / 100,
    aportesPatronalesHnl: fila.totalAportesCent / 100,
  }));
}

function responderReporte(res, nombre, filas, formato) {
  if (formato === 'json') return res.json({ data: filas, total: filas.length });
  if (formato === 'xlsx') {
    return res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .set('Content-Disposition', `attachment; filename="${nombre}.xlsx"`).send(crearXlsx(filas));
  }
  return res.type('application/pdf').set('Content-Disposition', `inline; filename="${nombre}.pdf"`).send(crearPdfReporte(nombre, filas));
}

function rutasReportes(ctx) {
  const router = express.Router();
  router.use(exigirAccesoReportes);

  // Los reportes leen tablas de proyeccion; sin refresco previo siempre
  // estarian vacias. Se actualiza SOLO el mes solicitado al vuelo.
  // Reglas de resiliencia (aprendidas bajo carga):
  //  - un solo refresco en vuelo: los demas esperan el mismo promise;
  //  - un fallo de refresco NUNCA se propaga ni queda sin manejar
  //    (mato el proceso por unhandledRejection): se registra y se sirve
  //    la proyeccion existente, aunque este desactualizada.
  let refrescoEnVuelo = null;
  const asegurarProyecciones = async (consulta) => {
    if (refrescoEnVuelo) {
      try { await refrescoEnVuelo; } catch { /* otro ya registro el fallo */ }
      return;
    }
    const anio = consulta?.anio ?? new Date().getFullYear();
    const mes = consulta?.mes ?? new Date().getMonth() + 1;
    const desde = new Date(Date.UTC(anio, mes - 1, 1));
    const hasta = new Date(Date.UTC(anio, mes, 0));
    refrescoEnVuelo = refrescarProyecciones(ctx, { desde, hasta }).catch((error) => {
      console.error('[reportes] Refresco de proyecciones fallo (se sirven datos previos):', error.message);
    });
    try {
      await refrescoEnVuelo;
    } catch { /* inalcanzable: el catch anterior ya normalizo */ }
    finally { refrescoEnVuelo = null; }
  };

  router.get('/asistencia', validar({ query: esquemaConsulta }), async (req, res, next) => {
    try {
      await asegurarProyecciones(req.query);
      const filas = await reportes.asistencia(req.query, req.contexto, ctx);
      responderReporte(res, 'asistencia', filas.map((fila) => ({
        anio: fila.anio, mes: fila.mes, empleadoId: fila.empleadoId,
        empleado: `${fila.empleado.nombres} ${fila.empleado.apellidos}`,
        departamento: fila.empleado.puesto.departamento.nombre,
        diasPresente: fila.diasPresente, diasAusente: fila.diasAusente,
        diasTardanza: fila.diasTardanza, minutosTardanza: fila.minutosTardanza,
        pctAusentismo: fila.pctAusentismo,
      })), req.query.formato);
    } catch (error) { next(error); }
  });

  router.get('/ausentismo', validar({ query: esquemaConsulta }), async (req, res, next) => {
    try { await asegurarProyecciones(req.query); responderReporte(res, 'ausentismo', await reportes.ausentismo(req.query, req.contexto, ctx), req.query.formato); } catch (error) { next(error); }
  });

  router.get('/personal-por-proyecto', validar({ query: esquemaConsulta }), async (req, res, next) => {
    try { await asegurarProyecciones(req.query); responderReporte(res, 'personal-por-proyecto', await reportes.personalPorProyecto(req.query, req.contexto, ctx), req.query.formato); } catch (error) { next(error); }
  });

  router.get('/costo-planilla', exigirPermiso('reportes:ver_global'), validar({ query: esquemaConsulta }), async (req, res, next) => {
    try { await asegurarProyecciones(req.query); responderReporte(res, 'costo-planilla', filasPlanillas(await reportes.costoPlanilla(req.query, req.contexto, ctx)), req.query.formato); } catch (error) { next(error); }
  });

  router.get('/empleados/buscar', validar({ query: esquemaTexto }), async (req, res, next) => {
    try { res.json({ data: await reportes.buscarEmpleados(req.query.q, req.contexto, ctx) }); } catch (error) { next(error); }
  });

  router.post('/refrescar', exigirPermiso('reportes:administrar'), async (req, res, next) => {
    try { res.status(202).json({ data: await refrescarProyecciones(ctx, rangoUltimosMeses(ctx.clock?.ahora?.() ?? new Date())) }); } catch (error) { next(error); }
  });

  return router;
}

function rutasAdminReportes(ctx) {
  const router = express.Router();
  router.use('/reportes', rutasReportes(ctx));
  return router;
}

module.exports = { rutasReportes, rutasAdminReportes, esquemaConsulta };
