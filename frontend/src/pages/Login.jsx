import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';

export default function Login({ onSuccess }) {
  const { login, loading, error, setError } = useAuth();
  const [email, setEmail] = useState('admin@demo');
  const [password, setPassword] = useState('admin123');
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLocalError('');
    setError('');

    if (!email.trim() || !password.trim()) {
      setLocalError('Email y contraseña son obligatorios.');
      return;
    }

    const ok = await login(email.trim(), password.trim());
    if (ok && onSuccess) {
      onSuccess();
    }
  };

  return (
    <section style={containerStyle}>
      <h2>Iniciar sesión</h2>
      <p style={infoStyle}>
        Usa las cuentas demo: <strong>admin@demo / admin123</strong>, <strong>prof@demo / prof123</strong>,{' '}
        <strong>alum@demo / alum123</strong>.
      </p>
      <form onSubmit={handleSubmit} style={formStyle}>
        <label style={labelStyle}>
          Correo
          <input
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
