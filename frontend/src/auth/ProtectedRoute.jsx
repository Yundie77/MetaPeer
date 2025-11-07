import React, { useEffect } from 'react';
import { useAuth } from './AuthContext.jsx';

export default function ProtectedRoute({ children, onNavigate, redirectTo = '/login' }) {
  const { token, loading } = useAuth();

  useEffect(() => {
    if (!loading && !token && onNavigate) {
      onNavigate(redirectTo);
    }
  }, [loading, token, onNavigate, redirectTo]);

  if (loading) {
    return <p>Cargando sesión...</p>;
  }

  if (!token) {
    return null;
  }

  return <>{children}</>;
}
