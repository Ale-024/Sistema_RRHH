import request from 'supertest';
import { codigoTotp } from '../../src/modules/iam/application/mfa';

const secretos = new WeakMap();

export async function loginConMfa(app, email, password = 'clave12345') {
  const secretosApp = secretos.get(app) ?? new Map();
  secretos.set(app, secretosApp);
  const secreto = secretosApp.get(email);
  let respuesta = await request(app).post('/api/auth/login').send({
    email,
    password,
    ...(secreto ? { otp: codigoTotp(secreto) } : {}),
  });

  if (respuesta.body.mfaSetupRequired) {
    const configuracion = await request(app)
      .post('/api/auth/mfa/setup')
      .set('Authorization', `Bearer ${respuesta.body.token}`);
    secretosApp.set(email, configuracion.body.secret);
    const code = codigoTotp(configuracion.body.secret);
    await request(app)
      .post('/api/auth/mfa/verify')
      .set('Authorization', `Bearer ${respuesta.body.token}`)
      .send({ code });
    respuesta = await request(app).post('/api/auth/login').send({ email, password, otp: code });
  }

  return respuesta.body.token;
}
