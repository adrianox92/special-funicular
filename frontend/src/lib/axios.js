import axios from 'axios';
import { supabase } from './supabase';

// DEBUG: Forzar recarga del archivo - versión actualizada para rutas públicas
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5001/api',
});

const TOKEN_CACHE_TTL_MS = 45_000;
let cachedToken = null;
let cachedTokenAt = 0;

/**
 * Invalida la caché del token (p.ej. tras logout).
 */
export function invalidateApiAccessTokenCache() {
  cachedToken = null;
  cachedTokenAt = 0;
}

// Interceptor para añadir token de autenticación cuando hay sesión (incluye rutas públicas con auth opcional)
api.interceptors.request.use(
  async (config) => {
    try {
      const now = Date.now();
      if (cachedToken && now - cachedTokenAt < TOKEN_CACHE_TTL_MS) {
        if (cachedToken) {
          config.headers.Authorization = `Bearer ${cachedToken}`;
        }
        return config;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token || null;
      cachedToken = token;
      cachedTokenAt = now;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      // Error al obtener la sesión, continuar sin token
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Interceptor para manejar errores de autenticación
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    if (error.response?.status === 401) {
      // Token expirado o inválido, intentar refrescar la sesión
      try {
        const {
          data: { session },
          error: refreshError,
        } = await supabase.auth.refreshSession();
        if (!refreshError && session) {
          cachedToken = session.access_token || null;
          cachedTokenAt = Date.now();
          // Reintentar la petición original con el nuevo token
          error.config.headers.Authorization = `Bearer ${session.access_token}`;
          return api(error.config);
        }
      } catch (refreshError) {
        invalidateApiAccessTokenCache();
        // Si no se pudo refrescar, redirigir al login
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export default api;
