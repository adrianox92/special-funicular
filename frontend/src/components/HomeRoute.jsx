import React from 'react';
import { Navigate } from 'react-router-dom';
import LandingPage from '../pages/LandingPage';
import { useAuth } from '../context/AuthContext';

/**
 * Punto de entrada en la URL base (p. ej. https://www.slotdatabase.es/).
 * - Con sesión activa → panel principal.
 * - Sin sesión → landing de marketing (misma ruta /).
 */
export default function HomeRoute() {
  const { user } = useAuth();

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <LandingPage />;
}
