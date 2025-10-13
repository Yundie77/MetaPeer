import React, { useEffect, useMemo, useState } from 'react';
import Nav from './components/Nav.jsx';
import Assignments from './pages/Assignments.jsx';
import Submissions from './pages/Submissions.jsx';
import Reviews from './pages/Reviews.jsx';
import ZipViewer from './components/ZipViewer.jsx';
import { API } from './api.js';

const currentRoute = () => `${window.location.pathname}${window.location.search}`;

export default function App() {
  const [route, setRoute] = useState(() => currentRoute());
  const [exportError, setExportError] = useState('');

  useEffect(() => {
    const handlePopState = () => setRoute(currentRoute());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (!exportError) {
      return;
    }
    const id = setTimeout(() => setExportError(''), 4000);
    return () => clearTimeout(id);
  }, [exportError]);

  const navigate = (path) => {
    if (!path) {
      return;
    }
    window.history.pushState({}, '', path);
    setRoute(currentRoute());
  };

  const { pathname, params } = useMemo(() => {
    const [path, search = ''] = route.split('?');
    return { pathname: path || '/', params: new URLSearchParams(search) };
  }, [route]);

  const assignmentId = params.get('assignmentId') || '';
  const submissionId = params.get('submissionId') || '';

  const handleExport = async () => {
    if (!assignmentId) {
      setExportError('Selecciona una asignación para exportar.');
      return;
    }

    try {
      const response = await fetch(`${API}/export/grades?assignmentId=${assignmentId}`);
      if (!response.ok) {
        const text = await response.text();
        try {
          const data = JSON.parse(text);
          throw new Error(data.error || 'No se pudo exportar.');
        } catch (err) {
          if (err instanceof SyntaxError) {
            throw new Error(text || 'No se pudo exportar.');
          }
          throw err;
        }
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `grades-assignment-${assignmentId}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setExportError(error.message);
    }
  };

  let content = <Assignments onNavigate={navigate} />;
  if (pathname === '/submissions') {
    content = <Submissions assignmentId={assignmentId} onNavigate={navigate} />;
  } else if (pathname === '/zip-viewer') {
    content = <ZipViewer />;
  } else if (pathname === '/reviews') {
    content = (
      <Reviews
        submissionId={submissionId}
        assignmentId={assignmentId}
        onNavigate={navigate}
      />
    );
  }

  return (
    <div style={containerStyle}>
      <Nav onNavigate={navigate} />
      {pathname === '/submissions' && assignmentId && (
        <div style={toolbarStyle}>
          <button type="button" style={exportButtonStyle} onClick={handleExport}>
            Exportar CSV
          </button>
        </div>
      )}
      {exportError && <p style={{ color: 'crimson' }}>{exportError}</p>}
      <main style={mainStyle}>{content}</main>
    </div>
  );
}

const containerStyle = {
  margin: '0 auto',
  padding: '1.5rem',
  maxWidth: '960px',
  fontFamily: 'Segoe UI, system-ui, sans-serif',
  color: '#1f1f1f'
};

const toolbarStyle = {
  margin: '1rem 0',
  display: 'flex'
};

const exportButtonStyle = {
  background: '#28a745',
  color: '#fff',
  border: 'none',
  padding: '0.45rem 0.9rem',
  borderRadius: '4px',
  cursor: 'pointer'
};

const mainStyle = {
  marginTop: '1rem'
};

