// Worker de Cloudflare: sirve el frontend (assets estaticos) y proxéa /api/* -> BACKEND_URL/api/*.
//
// Ventajas de proxear en vez de llamar al backend directamente:
//  - El frontend queda same-origin: la cookie de refresh (SameSite=Strict)
//    sigue funcionando sin abrir CORS ni relajar cookies.
//  - La URL del backend vive solo en una variable de entorno del dashboard.
//
// Variable requerida en el Worker: BACKEND_URL (sin barra final),
// por ejemplo https://sirh-api.onrender.com
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Todo lo que no es /api/* lo resuelven los assets estaticos (SPA).
    if (!url.pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request);
    }

    if (!env.BACKEND_URL) {
      return Response.json(
        { status: 500, title: 'Configuracion faltante', detail: 'BACKEND_URL no esta definida en las variables del Worker.' },
        { status: 500 }
      );
    }

    const destino = `${env.BACKEND_URL.replace(/\/+$/, '')}${url.pathname}${url.search}`;

    const cabeceras = new Headers(request.headers);
    cabeceras.delete('host');
    cabeceras.delete('content-length');

    const tieneCuerpo = !['GET', 'HEAD'].includes(request.method);
    const respuesta = await fetch(destino, {
      method: request.method,
      headers: cabeceras,
      body: tieneCuerpo ? await request.arrayBuffer() : undefined,
      redirect: 'manual',
    });

    // Se copian las cabeceras una a una para preservar multiples Set-Cookie.
    const salientes = new Headers();
    for (const [clave, valor] of respuesta.headers.entries()) {
      if (clave.toLowerCase() === 'set-cookie') continue;
      salientes.set(clave, valor);
    }
    for (const cookie of respuesta.headers.getSetCookie?.() ?? []) {
      // Cookie host-only: queda anclada al dominio del Worker (mismo origen).
      salientes.append('set-cookie', cookie);
    }

    return new Response(respuesta.body, { status: respuesta.status, headers: salientes });
  },
};
