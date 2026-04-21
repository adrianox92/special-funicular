import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Spinner } from './ui/spinner';
import { PENDING_CLUB_INVITE_KEY } from './PendingInviteConsumer';

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spinner className="size-8" />
        <span className="sr-only">Cargando...</span>
      </div>
    );
  }

  if (!user) {
    if (location.pathname === '/clubs/join') {
      const params = new URLSearchParams(location.search);
      const token = params.get('token')?.trim();
      if (token) {
        try {
          sessionStorage.setItem(PENDING_CLUB_INVITE_KEY, token);
        } catch {
          /* ignore quota / private mode */
        }
      }
    }
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default PrivateRoute;
