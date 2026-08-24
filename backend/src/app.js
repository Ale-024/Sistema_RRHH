const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const middlewareCors = require('./shared/http/cors');
const contextoRequest = require('./shared/http/contexto-request');
const noEncontrado = require('./shared/http/no-encontrado');
const manejadorErrores = require('./shared/http/manejador-errores');
const { crearCifrador } = require('./shared/infra/cifrado');

const iam = require('./modules/iam/iam.module');
const organizacion = require('./modules/organizacion/organizacion.module');
const empleados = require('./modules/empleados/empleados.module');
const asistencia = require('./modules/asistencia/asistencia.module');
const permisos = require('./modules/permisos/permisos.module');
const planilla = require('./modules/planilla/planilla.module');
const notificaciones = require('./modules/notificaciones/notificaciones.module');
const { registrarSuscriptores, rutasAdminAuditoria } = require('./modules/auditoria/auditoria.module');

/**
 * Composicion explicita de la aplicacion. Recibe sus dependencias,
 * lo que permite montarla en pruebas con base temporal y reloj congelado.
 * server.js es el unico archivo que abre el puerto.
 */
function crearApp(ctx) {
  const cifrador = ctx.cifrador ?? crearCifrador(ctx.entorno.CLAVE_CIFRADO);
  const c = { ...ctx, cifrador };

  // Suscriptores de eventos -> bitacora de auditoria.
  registrarSuscriptores(c.bus, c.prisma);

  const app = express();
  app.locals.prisma = c.prisma;

  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(helmet());
  app.use(middlewareCors(ctx.entorno));
  app.use(contextoRequest);

  // Zona de autoservicio: requiere token valido.
  const routerEmpleado = express.Router();
  routerEmpleado.use(
    iam.verificarToken,
    ...[
      empleados.rutasEmpleado,
      asistencia.rutasEmpleado,
      permisos.rutasEmpleado,
      planilla.rutasEmpleado,
      notificaciones.rutasEmpleado,
    ].map((fabrica) => fabrica(c))
  );

  // Zona de administracion: token + permisos cargados por peticion.
  // Cada ruta exige el suyo mediante exigirPermiso; los modulos
  // usuarios y auditoria montan su propia guardia especializada.
  const routerAdmin = express.Router();
  routerAdmin.use(iam.verificarToken, iam.cargarPermisos);
  routerAdmin.use(empleados.rutasAdminEmpleados(c));
  routerAdmin.use(organizacion.rutasAdminOrganizacion(c));
  routerAdmin.use(asistencia.rutasAdmin(c));
  routerAdmin.use(permisos.rutasAdmin(c));
  routerAdmin.use(planilla.rutasAdmin(c));
  routerAdmin.use(iam.rutasAdminUsuarios(c));
  routerAdmin.use(rutasAdminAuditoria(c));

  app.use('/api/auth', iam.rutasAuth(c));
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
