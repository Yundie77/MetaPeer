import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from './auth/AuthContext.jsx';
import ProtectedRoute from './auth/ProtectedRoute.jsx';
import Nav from './components/Nav.jsx';
import Assignments from './pages/Assignments.jsx';
import Submissions from './pages/Submissions.jsx';
import Reviews from './pages/Reviews.jsx';
import AdminDB from './pages/AdminDB.jsx';
import Subjects from './pages/Subjects.jsx';
import Professors from './pages/Professors.jsx';
import Feedback from './pages/Feedback.jsx';
import Export from './pages/Export.jsx';
import Login from './pages/Login.jsx';
import Profile from './pages/Profile.jsx';

const currentRoute = () => `${window.location.pathname}${window.location.search}`;

export default function App() {
  const { token, role } = useAuth();
  const [route, setRoute] = useState(() => currentRoute());

  useEffect(() => {
    const handler = () => setRoute(currentRoute());
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  const navigate = (path) => {
    if (!path || path === window.location.pathname + window.location.search) {
      return;
    }
    window.history.pushState({}, '', path);
    setRoute(currentRoute());
  };

  const { pathname } = useMemo(() => {
    const [path] = route.split('?');
    return { pathname: path || '/' };
  }, [route]);

  if (!token || pathname === '/login') {
    return <Login onSuccess={() => navigate('/assignments')} />;
  }

  const content = renderContent(pathname, role);

  return (
    <div style={containerStyle}>
      <Nav onNavigate={navigate} currentPath={pathname} />
      <main style={mainStyle}>
        <ProtectedRoute onNavigate={navigate}>{content}</ProtectedRoute>
      </main>
    </div>
  );
}

function renderContent(pathname, role) {
  if (pathname === '/' || pathname === '/assignments') {
    return <Assignments />;
  }
  if (pathname === '/subjects') {
    return <Subjects />;
  }
  if (pathname === '/submissions') {
    if (role === 'ALUM') {
      return <p>Las entregas ahora las sube el profesorado. Consulta la sección de Tareas.</p>;
    }
    return <Submissions />;
  }
  if (pathname === '/reviews') {
    return <Reviews />;
  }
  if (pathname === '/admin-db') {
    return <AdminDB />;
  }
  if (pathname === '/professors') {
    return <Professors />;
  }
  if (pathname === '/feedback') {
    return <Feedback />;
  }
  if (pathname === '/export') {
    return <Export />;
  }
  if (pathname === '/profile') {
    return <Profile />;
  }
  if (role === 'ADMIN' || role === 'PROF' || role === 'ALUM') {
    return <p>Página no encontrada.</p>;
  }
  return null;
}

const containerStyle = {
  margin: '0 auto',
  padding: '1.5rem',
  maxWidth: '2000px',
  fontFamily: 'Segoe UI, system-ui, sans-serif',
  color: '#1f1f1f'
};

const mainStyle = {
  marginTop: '1.5rem'
};
