import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { fetchJson, setAuthToken } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('metaPeerToken') || '');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!token);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setAuthToken('');
      setUser(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadProfile = async () => {
      try {
        setLoading(true);
        setError('');
        setAuthToken(token);
        const profile = await fetchJson('/me');
        if (!cancelled) {
          setUser({
            id: profile.id,
            nombre: profile.nombre,
            email: profile.email,
            rol: profile.rol
          });
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Error al recuperar la sesión:', err);
          setError('La sesión expiró. Inicia sesión de nuevo.');
          setToken('');
          localStorage.removeItem('metaPeerToken');
          setUser(null);
          setAuthToken('');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const login = async (email, password) => {
    try {
      setLoading(true);
      setError('');
      const data = await fetchJson('/login', {
        method: 'POST',
        body: { email, password },
        skipAuth: true
      });

      setToken(data.token);
      localStorage.setItem('metaPeerToken', data.token);
      setAuthToken(data.token);
      setUser({
        id: data.user.id,
        nombre: data.user.nombre,
        email: data.user.email,
        rol: data.user.rol
      });
      return true;
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'No pudimos iniciar sesión.');
      setToken('');
      setUser(null);
      setAuthToken('');
      localStorage.removeItem('metaPeerToken');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setToken('');
    setUser(null);
    setError('');
    setAuthToken('');
    localStorage.removeItem('metaPeerToken');
  };

  const value = useMemo(
    () => ({
      token,
      user,
      role: user?.rol || '',
      loading,
      error,
      login,
      logout,
      setError
    }),
    [token, user, loading, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return ctx;
}
