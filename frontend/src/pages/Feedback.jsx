import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { getJson } from '../api.js';

export default function Feedback() {
  const { role } = useAuth();
  const isStudent = useMemo(() => role === 'ALUM', [role]);
  const [assignments, setAssignments] = useState([]);
  const [assignmentId, setAssignmentId] = useState('');
  const [submissions, setSubmissions] = useState([]);
  const [reviews, setReviews] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadAssignments = async () => {
      try {
        setLoading(true);
        setError('');
        const data = await getJson('/assignments');
        setAssignments(data);
        if (data.length > 0) {
          setAssignmentId(String(data[0].id));
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadAssignments();
  }, []);

  useEffect(() => {
    if (!assignmentId) {
      setSubmissions([]);
      setReviews({});
      return;
    }
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const subsResponse = await getJson(`/submissions?assignmentId=${assignmentId}`);
        const subs = Array.isArray(subsResponse) ? subsResponse : subsResponse.submissions || [];
        setSubmissions(subs);
        const reviewMap = {};
        for (const submission of subs) {
          reviewMap[submission.id] = await getJson(`/reviews?submissionId=${submission.id}`);
        }
        setReviews(reviewMap);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [assignmentId, isStudent]);

  return (
    <section>
      <h2>Feedback recibido</h2>
      <p style={{ color: '#555', fontSize: '0.9rem' }}>
        Consulta las revisiones que han recibido tus entregas.
      </p>

      <label style={labelStyle}>
        Tarea
        <select style={inputStyle} value={assignmentId} onChange={(event) => setAssignmentId(event.target.value)}>
          {assignments.map((assignment) => (
            <option key={assignment.id} value={assignment.id}>
              {assignment.titulo}
            </option>
          ))}
        </select>
      </label>

      {error && <p style={errorStyle}>{error}</p>}
      {loading ? (
        <p>Cargando feedback...</p>
      ) : submissions.length === 0 ? (
        <p>No encontramos entregas para mostrar.</p>
      ) : (
        <ul style={listStyle}>
          {submissions.map((submission) => (
            <li key={submission.id} style={cardStyle}>
              <div>
                <strong>{submission.nombre_zip}</strong>
                <div style={metaStyle}>Subida: {submission.fecha_subida || 'sin fecha'}</div>
              </div>
              <ul style={innerListStyle}>
                {(reviews[submission.id] || []).map((review) => (
                  <li key={review.id} style={innerCardStyle}>
                    <div>Nota: {review.nota_numerica ?? 'sin nota'}</div>
                    {review.comentario && <div style={metaStyle}>{review.comentario}</div>}
                  </li>
                ))}
                {(reviews[submission.id] || []).length === 0 && <li style={metaStyle}>Sin revisiones aún.</li>}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const labelStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
  fontWeight: 600,
  maxWidth: '280px'
};

const inputStyle = {
  padding: '0.5rem 0.7rem',
  borderRadius: '4px',
  border: '1px solid #ccc'
};

const errorStyle = {
  color: 'crimson'
};

const listStyle = {
  listStyle: 'none',
  padding: 0,
  margin: '1.5rem 0',
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem'
};

const cardStyle = {
  border: '1px solid #e0e0e0',
  borderRadius: '8px',
  padding: '1rem',
  background: '#fff'
};

const innerListStyle = {
  listStyle: 'none',
  padding: 0,
  marginTop: '0.75rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem'
};

const innerCardStyle = {
  border: '1px solid #d0d0d0',
  borderRadius: '6px',
  padding: '0.6rem',
  background: '#fafafa'
};

const metaStyle = {
  fontSize: '0.85rem',
  color: '#666'
};
