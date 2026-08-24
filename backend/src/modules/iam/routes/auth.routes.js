const express = require('express');
const { iniciarSesion } = require('../application/iniciar-sesion.usecase');
const { iniciarSesion: esquemaLogin } = require('./esquemas');
const validar = require('../../../shared/http/validar');

function rutasAuth(ctx) {
  const router = express.Router();

  router.post('/login', validar({ body: esquemaLogin }), async (req, res, next) => {
    try {
      const resultado = await iniciarSesion(req.body, ctx);
      res.json({ message: 'Inicio de sesion exitoso', ...resultado });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { rutasAuth };
