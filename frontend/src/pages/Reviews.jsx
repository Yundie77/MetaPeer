import React, { useMemo } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import StudentReviews from './reviews/StudentReviews.jsx';
import MetaReviews from './reviews/MetaReviews.jsx';

export default function Reviews() {
  const { user, role } = useAuth();
  const isStudent = useMemo(() => role === 'ALUM', [role]);
  const isReviewer = useMemo(() => role === 'ADMIN' || role === 'PROF', [role]);

  return (
    <section>
      <h2>Revisiones</h2>
      {isStudent && <StudentReviews user={user} />}
      {isReviewer && <MetaReviews />}
      {!isStudent && !isReviewer && <p>No tienes permisos para ver esta sección.</p>}
    </section>
  );
}
