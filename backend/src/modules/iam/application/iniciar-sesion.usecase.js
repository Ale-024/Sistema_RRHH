const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const { ErrorAplicacion } = require('../../../shared/dominio/errores');
const { usuarioRequiereMfa, verificarCodigoTotp } = require('./mfa');
const {
  permisosDeUsuario,
  rolPrimario,
} = require('./permisos.usecase');

const INTENTOS_MAXIMOS = 5;
const MINUTOS_BLOQUEO = 15;
const DIAS_REFRESH = 7;

const PRIORIDAD_ROLES = [
  'ADMIN_TI',
  'RRHH_SUP',
  'DIRECCION',
  'GERENTE_DEPTO',
  'ENCUESTADOR',
  'EMPLEADO',
];

function sha256(texto) {
  return crypto.createHash('sha256').update(texto).digest('hex');
}

/**
 * Emite un refresh token opaco: se guarda solo su hash.
 */
async function crearSesionRefresh(tx, usuarioId, ip, userAgent) {
  const token = crypto.randomBytes(32).toString('hex');
  await tx.sesionRefresh.create({
    data: {
      usuarioId,
      tokenHash: sha256(token),
      familiaId: crypto.randomUUID(),
      expiraEn: new Date(Date.now() + DIAS_REFRESH * 24 * 60 * 60 * 1000),
      ip,
      userAgent,
    },
  });
  return token;
}

async function iniciarSesion(datos, ctx) {
  const { email, password } = datos;
  const { prisma, bus, clock, req } = ctx;

  const usuario = await prisma.usuario.findUnique({
    where: { email },
    include: {
      empleado: true,
      roles: { include: { rol: { include: { permisos: { include: { permiso: true } } } } } },
    },
  });

  const fallido = async () => {
    if (usuario) {
      const intentos = usuario.intentosFallidos + 1;
      await prisma.usuario.update({
        where: { id: usuario.id },
        data: {
          intentosFallidos: intentos,
          ...(intentos >= INTENTOS_MAXIMOS
            ? {
                bloqueadoHasta: new Date(Date.now() + MINUTOS_BLOQUEO * 60 * 1000),
                estado: 'BLOQUEADO',
              }
            : {}),
        },
      });
    }
    await registrarLoginFallido(ctx, email);
    throw new ErrorAplicacion('CREDENCIALES_INVALIDAS', 401, 'Credenciales invalidas.');
  };

  if (!usuario) return fallido();

  if (usuario.estado === 'INACTIVO') {
    throw new ErrorAplicacion(
      'CUENTA_DESATIVADA',
      403,
      'Cuenta desactivada. Contacte a RRHH.'
    );
  }

  if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > clock.ahora()) {
    throw new ErrorAplicacion(
      'CUENTA_BLOQUEADA',
      403,
      `Cuenta bloqueada por intentos fallidos. Intente despues de las ${usuario.bloqueadoHasta.toLocaleTimeString()}.`
    );
  }

  const passwordValida = await bcrypt.compare(password, usuario.password_hash);
  if (!passwordValida) return fallido();

  if (usuarioRequiereMfa(usuario) && usuario.mfaSecret && !usuario.mfaSecret.startsWith('PENDING:')) {
    if (!datos.otp || !verificarCodigoTotp(usuario.mfaSecret, datos.otp, clock.ahora().getTime())) {
      throw new ErrorAplicacion('MFA_REQUERIDO', 401, 'Debe proporcionar un codigo TOTP valido.');
    }
  }

  const permisos = permisosDeUsuario(usuario);
  const codigoRol = rolPrimario(usuario.roles.map((r) => r.rol.codigo), PRIORIDAD_ROLES);

  const accessToken = jwt.sign(
    { id: usuario.id, empleado_id: usuario.empleado?.id, roles: usuario.roles.map((r) => r.rol.codigo) },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  // La escritura de sesion y el reinicio de intentos van en una transaccion corta.
  const refreshToken = await prisma.$transaction(async (tx) => {
    await tx.usuario.update({
      where: { id: usuario.id },
      data: {
        intentosFallidos: 0,
        bloqueadoHasta: null,
        estado: 'ACTIVO',
        ultimoAcceso: clock.ahora(),
      },
    });
    return crearSesionRefresh(tx, usuario.id, req?.ip, req?.headers?.['user-agent']);
  });

  ctx.resCookie?.({
    key: 'sirh_refresh',
    value: refreshToken,
    maxAge: DIAS_REFRESH * 24 * 60 * 60 * 1000,
  });

  bus.publicar('SesionIniciada', { usuarioId: usuario.id });
  await auditarLogin(ctx, usuario);

  return {
    token: accessToken,
    user: {
      id: usuario.id,
      email: usuario.email,
      rol: codigoRol,
      nombres: usuario.empleado?.nombres,
      apellidos: usuario.empleado?.apellidos,
      debeCambiarPassword: usuario.debeCambiarPassword,
      permisos,
    },
  };
}

async function registrarLoginFallido(ctx, emailIntentado) {
  try {
    await ctx.prisma.auditoria.create({
      data: {
        entidad: 'Usuario',
        accion: 'LOGIN_FALLIDO',
        despues: JSON.stringify({ emailIntentado }),
        ip: ctx.req?.ip,
        userAgent: ctx.req?.headers?.['user-agent'],
        requestId: ctx.req?.contexto?.requestId,
      },
    });
  } catch (error) {
    console.error('[auditoria] No se pudo registrar LOGIN_FALLIDO:', error.message);
  }
}

async function auditarLogin(ctx, usuario) {
  try {
    await ctx.prisma.auditoria.create({
      data: {
        usuarioId: usuario.id,
        entidad: 'Usuario',
        entidadId: usuario.id,
        accion: 'LOGIN',
        ip: ctx.req?.ip,
        userAgent: ctx.req?.headers?.['user-agent'],
        requestId: ctx.req?.contexto?.requestId,
      },
    });
  } catch (error) {
    console.error('[auditoria] No se pudo registrar LOGIN:', error.message);
  }
}

module.exports = { iniciarSesion, crearSesionRefresh, sha256, PRIORIDAD_ROLES };
