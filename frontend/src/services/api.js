import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true, // envia la cookie del refresh token
});

// Evita renovaciones simultaneas: una sola peticion de refresh en vuelo.
let renovacionEnVuelo = null;

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const es401 = error.response?.status === 401;
    const noEsRutaAuth = original?.url && !original.url.includes('/auth/');

    // Token de acceso expirado: se renueva una sola vez y se reintenta.
    if (es401 && noEsRutaAuth && !original._reintentado) {
      original._reintentado = true;
      try {
        renovacionEnVuelo =
          renovacionEnVuelo ?? api.post('/auth/refresh', null);
        const res = await renovacionEnVuelo;
        renovacionEnVuelo = null;

        if (res.data?.token) {
          useAuthStore.getState().setToken(res.data.token);
          original.headers.Authorization = `Bearer ${res.data.token}`;
          return api(original);
        }
      } catch {
        renovacionEnVuelo = null;
        useAuthStore.getState().logout();
        window.location.href = '/login';
      }
    }

    // Normaliza errores RFC 7807 para el manejo actual de `message`.
    if (error.response?.data?.detail && !error.response.data.message) {
      error.response.data.message = error.response.data.detail;
    }
    return Promise.reject(error);
  }
);

export default api;
