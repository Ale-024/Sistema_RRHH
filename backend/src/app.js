const express = require('express');
const helmet = require('helmet');

const middlewareCors = require('./shared/http/cors');
const contextoRequest = require('./shared/http/contexto-request');
const noEncontrado = require('./shared/http/no-encontrado');
const manejadorErrores = require('./shared/http/manejador-errores');

const iam = require('./modules/iam/iam.module');
const organizacion = require('./modules/organizacion/organizacion.module');
const empleados = require('./modules/empleados/empleados.module');
const asistencia = require('./modules/asistencia/asistencia.module');
const permisos = require('./modules/permisos/permisos.module');
const planilla = require('./modules/planilla/planilla.module');
const notificaciones = require('./modules/notificaciones/notificaciones.module');

/**
 * Composicion explicita de la aplicacion. Recibe sus dependencias,
 * lo que permite montarla en pruebas con base temporal y reloj congelado.
 * server.js es el unico archivo que abre el puerto.
 */
function crearApp(ctx) {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use(helmet());
  app.use(middlewareCors(ctx.entorno));
  app.use(contextoRequest);

  // Autenticacion del modulo iam (fachada publica).
  const { verificarToken, esRolAdmin } = iam;

  // Zona de autoservicio del empleado: requiere token.
  const rutasEmpleado = [
    empleados.rutasEmpleado,
    asistencia.rutasEmpleado,
    permisos.rutasEmpleado,
    planilla.rutasEmpleado,
    notificaciones.rutasEmpleado,
  ].map((fabrica) => fabrica(ctx));

  const routerEmpleado = express.Router();
  routerEmpleado.use(verificarToken, ...rutasEmpleado);

  // Zona de administracion: requiere token y rol ADMIN.
  const rutasAdmin = [
    empleados.rutasAdminEmpleados,
    organizacion.rutasAdminOrganizacion,
    asistencia.rutasAdmin,
    permisos.rutasAdmin,
    planilla.rutasAdmin,
  ].map((fabrica) => fabrica(ctx));

  const routerAdmin = express.Router();
  routerAdmin.use(verificarToken, esRolAdmin, ...rutasAdmin);

  app.use('/api/auth', iam.rutasAuth(ctx));
  app.use('/api/employee', routerEmpleado);
  app.use('/api/admin', routerAdmin);
  app.get('/api/salud', (_req, res) => {
    res.json({ status: 'ok', mensaje: 'SIRH-MKT API en ejecucion' });
  });

  app.use(noEncontrado);
  app.use(manejadorErrores);
  return app;
}

module.exports = { crearApp };
