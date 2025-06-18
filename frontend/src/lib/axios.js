import axios from 'axios';
import { supabase } from './supabase';

// DEBUG: Forzar recarga del archivo - versión actualizada para rutas públicas
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5001/api'
});

// Interceptor para añadir token de autenticación automáticamente
api.interceptors.request.use(
  async (config) => {
    // Rutas públicas que no requieren autenticación
    const publicRoutes = [
      '/public-signup/',
      '/api/public-signup/',
      '/public/',
      '/api/public/'
    ];
    
    const isPublicRoute = publicRoutes.some(route => config.url.includes(route));
    
    if (!isPublicRoute) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          config.headers.Authorization = `Bearer ${session.access_token}`;
        }
      } catch (error) {
        // Error al obtener la sesión, continuar sin token
      }
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
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
        const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();
        if (!refreshError && session) {
          // Reintentar la petición original con el nuevo token
          error.config.headers.Authorization = `Bearer ${session.access_token}`;
          return api(error.config);
        }
      } catch (refreshError) {
        // Si no se pudo refrescar, redirigir al login
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api; 