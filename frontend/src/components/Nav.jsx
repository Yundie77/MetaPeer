import React, { useMemo } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';

export default function Nav({ onNavigate, currentPath }) {
  const { role, user, logout } = useAuth();

  const links = useMemo(() => {
    if (role === 'ADMIN') {
      return [
        { label: 'Asignaturas', path: '/subjects' },
        { label: 'Profesores', path: '/professors' },
        { label: 'Tareas', path: '/assignments' },
        { label: 'BD (CSV)', path: '/admin-db' },
        { label: 'Exportar', path: '/export' }
      ];
    }
    if (role === 'PROF') {
      return [
        { label: 'Asignaturas', path: '/subjects' },
        { label: 'Tareas', path: '/assignments' },
        { label: 'Importar CSV', path: '/admin-db' },
        { label: 'Exportar', path: '/export' }
      ];
    }
    if (role === 'ALUM') {
      return [
        { label: 'Entregas', path: '/submissions' },
        { label: 'Mis revisiones', path: '/reviews' },
        { label: 'Feedback', path: '/feedback' }
      ];
    }
    return [];
  }, [role]);

  const handleClick = (path) => {
    if (onNavigate) {
      onNavigate(path);
    }
  };

  return (
    <nav style={navStyle}>
      <div style={brandStyle}>
        <strong>Peer Review MVP</strong>
        <span style={roleStyle}>{role}</span>
      </div>
      <div style={linksStyle}>
        {links.map((link) => (
          <button
            key={link.path}
            type="button"
            onClick={() => handleClick(link.path)}
            style={buttonStyle(currentPath === link.path)}
          >
            {link.label}
          </button>
        ))}
      </div>
      <div style={userStyle}>
        <span>{user?.nombre}</span>
        <button type="button" style={logoutStyle} onClick={logout}>
          Salir
        </button>
      </div>
    </nav>
  );
}

const navStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '1rem',
  background: '#20232a',
  color: '#fff',
  padding: '0.75rem 1rem',
  borderRadius: '8px'
};

const brandStyle = {
  display: 'flex',
  flexDirection: 'column'
};

const roleStyle = {
  fontSize: '0.8rem',
  color: '#a0a0a0',
  textTransform: 'uppercase'
};

const linksStyle = {
  display: 'flex',
  gap: '0.5rem',
  flexWrap: 'wrap',
  justifyContent: 'center',
  flex: 1
};

const userStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  fontSize: '0.9rem'
};

const buttonStyle = (active) => ({
  background: active ? '#61dafb' : '#313640',
  color: active ? '#000' : '#fff',
  border: active ? '1px solid #61dafb' : '1px solid #424650',
  padding: '0.4rem 0.75rem',
  borderRadius: '4px',
  cursor: 'pointer',
  fontWeight: 600
});

const logoutStyle = {
  background: '#ff595e',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  padding: '0.35rem 0.6rem',
  cursor: 'pointer'
};
