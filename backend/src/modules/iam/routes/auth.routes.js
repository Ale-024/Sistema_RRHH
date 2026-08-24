const express = require('express');
const { z } = require('zod');
const { iniciarSesion } = require('../application/iniciar-sesion.usecase');
const { refrescarSesion, cerrarSesion } = require('../application/sesiones.usecase');
const { cambiarPassword } = require('../application/cambiar-password.usecase');
const { verificarToken } = require('../application/autenticacion');
const validar = require('../../../shared/http/validar');

const esquemaLogin = z.object({
  email: z.string().trim().min(1).email('Debe ser un correo valido'),
  password: z.string().min(1, 'La contrasena es obligatoria'),
});

const esquemaPassword = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'La nueva contrasena debe tener al menos 8 caracteres'),
});

const COOKIE_REFRESH = 'sirh_refresh';

function opcionesCookie(req) {
  return {
    httpOnly: true,
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
    sameSite: 'strict',
    path: '/api/auth',
  };
}

/**
 * Rutas de autenticacion. Contrato MVP conservado en /login; se agregan
 * refresh, logout y cambio de contrasena segun el plan de Fase 2.
 */
function rutasAuth(ctx) {
  const router = express.Router();

  const conCtx = (req, res) => ({
    ...ctx,
    req,
    res,
    resCookie: ({ key, value, maxAge }) =>
      res.cookie(key, value, { ...opcionesCookie(req), maxAge }),
  });

  router.post('/login', validar({ body: esquemaLogin }), async (req, res, next) => {
    try {
      const resultado = await iniciarSesion(req.body, conCtx(req, res));
      res.json({ message: 'Inicio de sesion exitoso', ...resultado });
    } catch (error) {
      next(error);
    }
  });

  router.post('/refresh', async (req, res, next) => {
    try {
      const resultado = await refrescarSesion(
        req.cookies?.[COOKIE_REFRESH],
        conCtx(req, res)
      );
      res.json(resultado);
    } catch (error) {
      next(error);
    }
  });

  router.post('/logout', verificarToken, async (req, res, next) => {
    try {
      const resultado = await cerrarSesion(
        req.user.id,
        req.cookies?.[COOKIE_REFRESH],
        conCtx(req, res)
      );
      res.json(resultado);
    } catch (error) {
      next(error);
    }
  });

  router.put(
    '/password',
    verificarToken,
    validar({ body: esquemaPassword }),
    async (req, res, next) => {
      try {
        res.json(await cambiarPassword(req.user.id, req.body.currentPassword, req.body.newPassword, conCtx(req, res)));
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}

module.exports = { rutasAuth, COOKIE_REFRESH };
