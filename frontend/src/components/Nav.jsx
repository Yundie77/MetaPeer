import React, { useMemo } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import metaPeerLogo from '../../logo.svg';

export default function Nav({ onNavigate, currentPath }) {
  const { role, user, logout } = useAuth();

  const links = useMemo(() => {
    if (role === 'ADMIN') {
      return [
        { label: 'Asignaturas', path: '/subjects' },
        { label: 'Profesores', path: '/professors' },
        { label: 'Asignaciones', path: '/assignments' },
        { label: 'Revisiones', path: '/reviews' },
        { label: 'BD (CSV)', path: '/admin-db' },
        { label: 'Exportar', path: '/export' }
      ];
    }
    if (role === 'PROF') {
      return [
        { label: 'Asignaciones', path: '/assignments' },
        { label: 'Revisiones', path: '/reviews' },
        { label: 'Exportar', path: '/export' }
      ];
    }
    if (role === 'ALUM') {
      return [
        { label: 'Mis revisiones', path: '/reviews' },
        { label: 'Feedback', path: '/feedback' }
      ];
    }
    return [];
  }, [role]);

  const defaultHomePath = useMemo(() => {
    if (role === 'ADMIN') return '/subjects';
    if (role === 'PROF') return '/assignments';
    if (role === 'ALUM') return '/reviews';
    return '/';
  }, [role]);

  const handleClick = (path) => {
    if (onNavigate) {
      onNavigate(path);
    }
  };

  return (
    <nav style={navStyle}>
      <div style={brandStyle}>
        <button
          type="button"
          style={brandButtonStyle}
          onClick={() => handleClick(defaultHomePath)}
          title="Ir al inicio"
          aria-label="Ir a la página principal"
        >
          <img src={metaPeerLogo} alt="MetaPeer" style={logoStyle} />
        </button>
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
        <button
          type="button"
          onClick={() => handleClick('/profile')}
          style={profileButtonStyle(currentPath === '/profile')}
        >
          <span style={profileIconStyle} aria-hidden="true">
            👤
          </span>
          <span>{user?.nombre || 'Perfil'}</span>
        </button>
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
  background: 'rgb(14, 15, 18)',
  color: '#fff',
  padding: '0.75rem 1rem',
  borderRadius: '8px'
};

const brandStyle = {
  display: 'flex',
  flexDirection: 'column'
};

const brandTitleStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem'
};

const brandButtonStyle = {
  ...brandTitleStyle,
  background: 'transparent',
  border: 'none',
  padding: 0,
  cursor: 'pointer'
};

const logoStyle = {
  width: '200px',
  height: '50px',
  objectFit: 'contain',
  display: 'block'
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

const profileButtonStyle = (active) => ({
  display: 'flex',
  alignItems: 'center',
  gap: '0.35rem',
  background: active ? '#61dafb' : '#313640',
  color: active ? '#000' : '#fff',
  border: active ? '1px solid #61dafb' : '1px solid #424650',
  padding: '0.35rem 0.65rem',
  borderRadius: '6px',
  cursor: 'pointer',
  fontWeight: 700
});

const profileIconStyle = {
  fontSize: '1rem',
  lineHeight: 1
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
