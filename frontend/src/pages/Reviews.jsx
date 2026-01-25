import React, { useMemo } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import StudentReviews from './reviews/StudentReviews.jsx';
import MetaReviews from './reviews/MetaReviews.jsx';
import ReviewViewer from './reviews/ReviewViewer.jsx';
import { readFromURL } from '../utils/permalink.js';

export default function Reviews() {
  const { user, role } = useAuth();
  const isStudent = useMemo(() => role === 'ALUM', [role]);
  const isReviewer = useMemo(() => role === 'ADMIN' || role === 'PROF', [role]);
  const { revisionId } = readFromURL();

  if (isReviewer && revisionId) {
    return (
      <section>
        <h2>Revisión puntual</h2>
        <button
          type="button"
          style={backButtonStyle}
          onClick={() => {
            window.history.pushState({}, '', '/reviews'); // Sin recargar la página
            window.dispatchEvent(new PopStateEvent('popstate')); // “simula” un cambio de ruta
          }}
        >
          Volver a Revisiones
        </button>
        <ReviewViewer revisionId={revisionId} />
      </section>
    );
  }

  return (
    <section>
      <h2>Revisiones</h2>
      {isStudent && <StudentReviews user={user} />}
      {isReviewer && <MetaReviews />}
      {!isStudent && !isReviewer && <p>No tienes permisos para ver esta sección.</p>}
    </section>
  );
}

const backButtonStyle = {
  background: '#0b74de',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  padding: '0.5rem 0.9rem',
  cursor: 'pointer',
  fontWeight: 600,
  marginBottom: '1rem'
};
