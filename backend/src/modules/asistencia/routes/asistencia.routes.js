const express = require('express');
const { z } = require('zod');
const { registrarMarcaje } = require('../application/registrar-marcaje.usecase');
const { importarLote } = require('../application/importar-lote.usecase');
const { cerrarDias, reabrirDia, corregirRegistro } = require('../application/control-dias.usecase');
const validar = require('../../../shared/http/validar');
const { exigirPermiso } = require('../../../shared/http/autorizacion');
const { aplicarAlcanceRelacion } = require('../../../shared/dominio/alcance');
const { ErrorAplicacion } = require('../../../shared/dominio/errores');

function contextoDe(req) {
  return {
    usuarioId: req.user?.id,
    permisos: req.contexto?.permisos,
    ip: req.ip,
    requestId: req.contexto?.requestId,
  };
}

const esquemaMarcajePropio = z
  .object({
    latitud: z.coerce.number().min(-90).max(90).optional(),
    longitud: z.coerce.number().min(-180).max(180).optional(),
    // RF-16 / CU02.2: proyecto de campo del encuestador (opcional).
    proyectoId: z.coerce.number().int().positive().optional(),
    dispositivo: z.string().trim().max(60).default('web'),
  })
  .partial({ dispositivo: true });

const esquemaRangoFechas = z.object({
  desde: z.coerce.date().optional(),
  hasta: z.coerce.date().optional(),
});

/**
 * Convierte 'hasta' (medianoche) en limite EXCLUSIVO del dia siguiente;
 * de lo contrario el rango excluye todo el ultimo dia seleccionado.
 */
function inicioDeDiaLocal(valor) {
  const iso = valor instanceof Date ? valor.toISOString() : String(valor ?? '');
  let m = /^(\d{4})-(\d{2})-(\d{2})T00:00:00(?:\.\d+)?Z$/.exec(iso);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (m && !(valor instanceof Date)) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = valor instanceof Date ? valor : new Date(valor);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Convierte 'hasta' en limite EXCLUSIVO de fin del dia LOCAL. */
function finDeDia(hasta) {
  const fin = inicioDeDiaLocal(hasta);
  fin.setDate(fin.getDate() + 1);
  return fin;
}

const esquemaImportarLote = z.object({
  // Campos libres a proposito: la validacion fina es por linea en el
  // usecase, que reporta cada linea mala en `rechazados` sin abortar
  // todo el lote.
  eventos: z.array(z.record(z.unknown())).min(1).max(5000),
});

const esquemaCierre = z.object({
  desde: z.coerce.date(),
  hasta: z.coerce.date(),
});

const esquemaReapertura = z.object({
  empleadoId: z.coerce.number().int().positive(),
  fecha: z.coerce.date(),
  motivo: z.string().trim().min(10).max(500),
});

const esquemaCorreccion = z.object({
  horaEntrada: z.coerce.date().optional(),
  horaSalida: z.coerce.date().optional(),
  estadoDia: z
    .enum(['PRESENTE', 'AUSENTE', 'TARDANZA', 'PERMISO', 'VACACION', 'INCAPACIDAD', 'DESCANSO', 'FERIADO'])
    .optional(),
  motivo: z.string().trim().min(10).max(500),
});

const esquemaConsolidar = z.object({
  fecha: z.coerce.date().default(() => new Date()),
});

const esquemaTurno = z.object({
  nombre: z.string().trim().min(1).max(60),
  horaEntrada: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:mm'),
  horaSalida: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:mm'),
  cruzaMedianoche: z.boolean().default(false),
  toleranciaMin: z.coerce.number().int().min(0).max(240).default(10),
  minutosAlmuerzo: z.coerce.number().int().min(0).max(240).default(60),
  diasSemana: z
    .string()
    .regex(/^[1-7](,[1-7])*$/, 'Dias ISO separados por coma (1=lunes)')
    .default('1,2,3,4,5'),
});

const esquemaHorario = z.object({
  empleadoId: z.coerce.number().int().positive(),
  turnoId: z.coerce.number().int().positive(),
  desde: z.coerce.date(),
  hasta: z.coerce.date().optional(),
});

const esquemaFeriado = z.object({
  fecha: z.coerce.date(),
  nombre: z.string().trim().min(3).max(80),
  tipo: z.enum(['NACIONAL', 'EMPRESA']).default('NACIONAL'),
  remunerado: z.boolean().default(true),
});

/**
 * Rutas de autoservicio. Contrato MVP: /api/employee/attendance.
 */
function rutasEmpleado(ctx) {
  const { prisma, clock } = ctx;
  const router = express.Router();

  router.post(
    '/attendance',
    validar({ body: esquemaMarcajePropio }),
    async (req, res, next) => {
      try {
        if (!req.user.empleado_id) {
          throw new ErrorAplicacion('SIN_EMPLEADO', 400, 'El usuario no tiene expediente.');
        }
        res.json(await registrarMarcaje(req.user.empleado_id, req.body, ctx));
      } catch (error) {
        next(error);
      }
    }
  );

  router.get(
    '/attendance',
    validar({ query: esquemaRangoFechas }),
    async (req, res, next) => {
      try {
        const { desde, hasta } = req.query;
        res.json(
          await prisma.registroAsistencia.findMany({
            where: {
              empleadoId: req.user.empleado_id,
              ...(desde || hasta ? { fecha: { ...(desde ? { gte: inicioDeDiaLocal(desde) } : {}), ...(hasta ? { lt: finDeDia(hasta) } : {}) } } : {}),
            },
            include: { turno: { select: { nombre: true } } },
            orderBy: { fecha: 'desc' },
          })
        );
      } catch (error) {
        next(error);
      }
    }
  );

  // Estado actual del dia para el boton de marcaje.
  router.get('/attendance/hoy', async (req, res, next) => {
    try {
      const ahora = clock.ahora();
      const inicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
      const fin = new Date(inicio);
      fin.setDate(fin.getDate() + 1);
      const marcajes = await prisma.marcaje.findMany({
        where: { empleadoId: req.user.empleado_id, ocurridoEn: { gte: inicio, lt: fin } },
        orderBy: { ocurridoEn: 'asc' },
      });
      const ultimaEntrada = [...marcajes].reverse().find((m) => m.tipo === 'ENTRADA');
      const haySalidaDespues = ultimaEntrada && marcajes.some((m) => m.tipo === 'SALIDA' && m.ocurridoEn > ultimaEntrada.ocurridoEn);
      // Detalle de los marcajes del dia para que la UI muestre las horas.
      const detalle = marcajes.map((m) => ({ id: m.id, tipo: m.tipo, ocurridoEn: m.ocurridoEn }));
      const salida = [...detalle].reverse().find((m) => m.tipo === 'SALIDA');
      res.json({
        puedeMarcarEntrada: !ultimaEntrada || haySalidaDespues,
        proximoTipo: !ultimaEntrada || haySalidaDespues ? 'ENTRADA' : 'SALIDA',
        marcajesDelDia: marcajes.length,
        marcajes: detalle,
        ultimaEntrada: ultimaEntrada?.ocurridoEn || null,
        ultimaSalida: salida?.ocurridoEn || null,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

/**
 * Rutas administrativas. Contrato MVP conservado en /attendance;
 * se agregan importacion, consolidacion, cierre y correcciones.
 */
function rutasAdmin(ctx) {
  const { prisma } = ctx;
  const router = express.Router();

  router.get(
    '/attendance',
    exigirPermiso('asistencia:leer_global'),
    validar({ query: esquemaRangoFechas }),
    async (req, res, next) => {
      try {
        const { desde, hasta } = req.query;
        res.json(
          await prisma.registroAsistencia.findMany({
            where: aplicarAlcanceRelacion(
              'empleado',
              desde || hasta
                ? { fecha: { ...(desde ? { gte: inicioDeDiaLocal(desde) } : {}), ...(hasta ? { lt: finDeDia(hasta) } : {}) } }
                : {},
              req.contexto
            ),
            include: {
              empleado: {
                select: {
                  id: true,
                  nombres: true,
                  apellidos: true,
                  dni: true,
                  puesto: { select: { titulo: true, departamento: { select: { nombre: true } } } },
                },
              },
              turno: { select: { nombre: true } },
            },
            orderBy: [{ fecha: 'desc' }, { empleadoId: 'asc' }],
          })
        );
      } catch (error) {
        next(error);
      }
    }
  );

  // ── Importacion por lote ──
  router.post(
    '/asistencia/importar-lote',
    exigirPermiso('asistencia:importar'),
    validar({ body: esquemaImportarLote }),
    async (req, res, next) => {
      try {
        const reporte = await importarLote(req.body.eventos, ctx);
        res.json({ message: 'Importacion procesada.', reporte });
      } catch (error) {
        next(error);
      }
    }
  );

  // ── Consolidado diario (tarea programada o manual) ──
  router.post(
    '/asistencia/consolidar',
    exigirPermiso('asistencia:importar'),
    validar({ body: esquemaConsolidar }),
    async (req, res, next) => {
      try {
        const { consolidarDia } = require('../application/consolidar-dia.usecase');
        const resultado = await consolidarDia(req.body.fecha, ctx);
        res.json({ message: `Consolidado ejecutado para ${resultado.fecha}.`, ...resultado });
      } catch (error) {
        next(error);
      }
    }
  );

  // ── Cierre y reapertura ──
  router.post(
    '/asistencia/cierre',
    exigirPermiso('asistencia:cerrar'),
    validar({ body: esquemaCierre }),
    async (req, res, next) => {
      try {
        res.json(await cerrarDias(req.body, contextoDe(req), ctx));
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/asistencia/reapertura',
    exigirPermiso('asistencia:cerrar'),
    validar({ body: esquemaReapertura }),
    async (req, res, next) => {
      try {
        res.json(await reabrirDia(req.body, contextoDe(req), ctx));
      } catch (error) {
        next(error);
      }
    }
  );

  // ── Correccion con motivo obligatorio ──
  router.patch(
    '/asistencia/:id',
    exigirPermiso('asistencia:corregir'),
    validar({ params: z.object({ id: z.coerce.number().int().positive() }), body: esquemaCorreccion }),
    async (req, res, next) => {
      try {
        res.json(await corregirRegistro(req.params.id, req.body, contextoDe(req), ctx));
      } catch (error) {
        next(error);
      }
    }
  );

  // ── Catalogo de turnos ──
  router.get('/turnos', async (_req, res, next) => {
    try {
      res.json(await prisma.turno.findMany({ where: { activo: true }, orderBy: { id: 'asc' } }));
    } catch (error) {
      next(error);
    }
  });

  router.post(
    '/turnos',
    exigirPermiso('organizacion:administrar'),
    validar({ body: esquemaTurno }),
    async (req, res, next) => {
      try {
        res.json(await prisma.turno.create({ data: req.body }));
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/horarios',
    exigirPermiso('organizacion:administrar'),
    validar({ body: esquemaHorario }),
    async (req, res, next) => {
      try {
        res.json(await prisma.horarioEmpleado.create({ data: req.body }));
      } catch (error) {
        next(error);
      }
    }
  );

  // ── Feriados ──
  router.get('/feriados', async (_req, res, next) => {
    try {
      res.json(await prisma.diaFeriado.findMany({ orderBy: { fecha: 'desc' } }));
    } catch (error) {
      next(error);
    }
  });

  router.post(
    '/feriados',
    exigirPermiso('organizacion:administrar'),
    validar({ body: esquemaFeriado }),
    async (req, res, next) => {
      try {
        res.json(await prisma.diaFeriado.create({ data: req.body }));
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}

module.exports = { rutasEmpleado, rutasAdmin };
