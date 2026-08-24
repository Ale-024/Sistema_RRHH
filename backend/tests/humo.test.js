import { describe, it, expect } from 'vitest';
import request from 'supertest';
import BusEventos from '../src/shared/event-bus';
import reloj from '../src/shared/reloj';
import { crearApp } from '../src/app';

/**
 * Pruebas de humo sobre la aplicacion completa sin tocar base de datos:
 * validacion de entorno en rutas con esquema y formato RFC 7807.
 */
function appDePrueba() {
  return crearApp({
    prisma: {},
    bus: new BusEventos(),
    clock: reloj,
    entorno: {
      PORT: 0,
      CLAVE_CIFRADO: Buffer.alloc(32, 7).toString('base64'),
      origenesPermitidos: ['http://localhost:5173'],
    },
  });
}

describe('humo de la API', () => {
  it('responde salud', async () => {
    const res = await request(appDePrueba()).get('/api/salud');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('rechaza login sin cuerpo con 422 problem+json', async () => {
    const res = await request(appDePrueba())
      .post('/api/auth/login')
      .send({ email: 'no-es-correo', password: '' });
    expect(res.status).toBe(422);
    expect(res.type).toBe('application/problem+json');
    expect(res.body.errores.length).toBeGreaterThan(0);
    expect(res.body.requestId).toBeTruthy();
  });

  it('rechaza ruta inexistente con 404 problem+json', async () => {
    const res = await request(appDePrueba()).get('/api/inexistente');
    expect(res.status).toBe(404);
    expect(res.body.title).toBeTruthy();
  });

  it('exige token en zona de empleado (401 problem+json)', async () => {
    const res = await request(appDePrueba()).get('/api/employee/profile');
    expect(res.status).toBe(401);
    expect(res.type).toBe('application/problem+json');
  });

  it('rechaza origen no permitido por CORS', async () => {
    const res = await request(appDePrueba())
      .get('/api/salud')
      .set('Origin', 'http://malicioso.com');
    expect(res.status).toBe(500);
  });

  it('acepta origen permitido por CORS', async () => {
    const res = await request(appDePrueba())
      .get('/api/salud')
      .set('Origin', 'http://localhost:5173');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(
      'http://localhost:5173'
    );
  });
});
