import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';

const OWNER_DEBUG_ENABLED = import.meta.env.DEV && import.meta.env.VITE_OWNER_DEBUG === '1';

export default function Login({ onSuccess }) {
  const { login, loading, error, setError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [quickUsers, setQuickUsers] = useState([]);

  useEffect(() => {
    if (!OWNER_DEBUG_ENABLED) return undefined;

    let cancelled = false;

    async function loadQuickUsers() {
      try {
        const response = await fetch('/quick-users.local.json', { cache: 'no-store' });
        if (!response.ok) return;

        const payload = await response.json();
        const rawUsers = Array.isArray(payload) ? payload : Array.isArray(payload?.users) ? payload.users : [];
        const parsedUsers = rawUsers
          .map((user, index) => {
            const emailValue = String(user?.email || '').trim();
            const passwordValue = String(user?.password || '').trim();
            const labelValue = String(user?.label || emailValue || `Usuario ${index + 1}`).trim();

            if (!emailValue || !passwordValue) {
              return null;
            }

            return {
              label: labelValue,
              email: emailValue,
              password: passwordValue
            };
          })
          .filter(Boolean);

        if (!cancelled) {
          setQuickUsers(parsedUsers);
        }
      } catch (_error) {
        if (!cancelled) {
          setQuickUsers([]);
        }
      }
    }

    loadQuickUsers();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLocalError('');
    setError('');

    if (!email.trim() || !password.trim()) {
      setLocalError('Email y contraseña son obligatorios.');
      return;
    }

    const loggedUser = await login(email.trim(), password.trim());
    if (loggedUser && onSuccess) {
      onSuccess(loggedUser);
    }
  };

  const handleQuickLogin = async (user) => {
    if (loading) return;
    setEmail(user.email);
    setPassword(user.password);
    setLocalError('');
    setError('');
    const loggedUser = await login(user.email, user.password);
    if (loggedUser && onSuccess) {
      onSuccess(loggedUser);
    }
  };

  return (
    <section style={containerStyle}>
      <div style={heroStyle}>
        <img src="/logo.svg" alt="MetaPeer" style={logoStyle} />
        <p style={taglineStyle}>Sistema para la evaluación peer-to-peer de prácticas</p>
      </div>
      <h2>Iniciar sesión</h2>
      {OWNER_DEBUG_ENABLED && (
        <div style={quickPanelStyle}>
          {quickUsers.length > 0 ? (
            <div style={quickRowStyle}>
              {quickUsers.map((user) => (
                <button
                  key={user.email}
                  type="button"
                  style={quickButtonStyle}
                  onClick={() => handleQuickLogin(user)}
                  disabled={loading}
                >
                  Entrar como {user.label}
                </button>
              ))}
            </div>
          ) : (
            <p style={quickHintStyle}>
              Owner debug activo sin usuarios. Crea <code>frontend/public/quick-users.local.json</code>.
            </p>
          )}
        </div>
      )}
      <form onSubmit={handleSubmit} style={formStyle}>
        <label style={labelStyle}>
          Correo
          <input
            placeholder={`Ej: alumno@ucm.es`}
            style={inputStyle}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={loading}
          />
        </label>
        <label style={labelStyle}>
          Contraseña
          <input
            placeholder="Tu contraseña"
            style={inputStyle}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={loading}
          />
        </label>
        <button type="submit" style={buttonStyle} disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
      {(localError || error) && <p style={errorStyle}>{localError || error}</p>}
    </section>
  );
}

const containerStyle = {
  maxWidth: '400px',
  margin: '2rem auto',
  padding: '1.5rem',
  border: '1px solid #d0d0d0',
  borderRadius: '8px',
  background: '#fff',
  boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
};

const heroStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  marginBottom: '1rem'
};

const logoStyle = {
  width: '320px',
  maxWidth: '100%',
  height: 'auto',
  marginBottom: '0.75rem'
};

const taglineStyle = {
  margin: 0,
  color: '#4b5563',
  fontSize: '0.95rem',
  lineHeight: 1.35
};

const formStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem'
};

const labelStyle = {
  display: 'flex',
  flexDirection: 'column',
  fontWeight: 600
};

const inputStyle = {
  marginTop: '0.35rem',
  padding: '0.6rem 0.75rem',
  border: '1px solid #c5c5c5',
  borderRadius: '4px'
};

const buttonStyle = {
  padding: '0.6rem 0.75rem',
  background: '#0078d4',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer'
};

const errorStyle = {
  marginTop: '1rem',
  color: 'crimson'
};

const infoStyle = {
  fontSize: '0.9rem',
  color: '#555'
};

const quickRowStyle = {
  display: 'flex',
  gap: '0.5rem',
  flexWrap: 'wrap',
  margin: '0.5rem 0 1rem'
};

const quickPanelStyle = {
  margin: '0.5rem 0 1rem'
};

const quickHintStyle = {
  margin: '0.5rem 0 0',
  fontSize: '0.85rem',
  color: '#6b7280'
};

const quickButtonStyle = {
  padding: '0.45rem 0.7rem',
  background: '#eef2ff',
  color: '#1f3a8a',
  border: '1px solid #cbd5ff',
  borderRadius: '4px',
  cursor: 'pointer',
  fontWeight: 600
};
