import axios from 'axios';
import { supabase } from './supabase';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5001/api'
});

// Interceptor para añadir el token de autenticación
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

// Interceptor para manejar errores de autenticación
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Si el token expiró, intentar refrescar la sesión
      const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();
      if (!refreshError && session) {
        // Reintentar la petición original con el nuevo token
        error.config.headers.Authorization = `Bearer ${session.access_token}`;
        return api(error.config);
      }
      // Si no se pudo refrescar, redirigir al login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api; 