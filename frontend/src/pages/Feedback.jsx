import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { getJson } from '../api.js';
import {
  labelStyle as sharedLabelStyle,
  inputStyle as sharedInputStyle,
  reviewSelectorWrap,
  errorStyle as sharedErrorStyle
} from './reviews/styles.js';

const formatSimpleDate = (value) => {
  if (!value) return 'sin fecha';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'sin fecha';
  return parsed.toLocaleDateString('es-ES');
};

const safeCount = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

const getAssignmentOptionLabel = (assignment, reviewedSubmissionsCount = 0) => {
  const title = assignment?.titulo || 'Sin título';
  const dueDate = formatSimpleDate(assignment?.fecha_entrega);
  const reviewedCount = safeCount(reviewedSubmissionsCount);
  return `${title} · Entrega: ${dueDate} · Entregas revisadas: ${reviewedCount}`;
};

export default function Feedback() {
  const { role } = useAuth();
  const isStudent = useMemo(() => role === 'ALUM', [role]);
  const [assignments, setAssignments] = useState([]);
  const [assignmentId, setAssignmentId] = useState('');
  const [submissions, setSubmissions] = useState([]);
  const [reviews, setReviews] = useState({});
  const [reviewedSubmissionsByAssignment, setReviewedSubmissionsByAssignment] = useState({});
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
        const counts = {};
        for (const assignment of data) {
          const assignmentKey = String(assignment.id);
          const subsResponse = await getJson(`/submissions?assignmentId=${assignment.id}`);
          const subs = Array.isArray(subsResponse) ? subsResponse : subsResponse.submissions || [];
          if (subs.length === 0) {
            counts[assignmentKey] = 0;
            continue;
          }
          const reviewLists = await Promise.all(
            subs.map((submission) => getJson(`/reviews?submissionId=${submission.id}`))
          );
          const reviewedSubmissions = subs.reduce((acc, submission, index) => {
            const reviewRows = Array.isArray(reviewLists[index]) ? reviewLists[index] : [];
            const hasReviewFromAnotherTeam = reviewRows.some(
              (review) =>
                review?.fecha_envio &&
                review?.equipo_revisor?.id &&
                String(review.equipo_revisor.id) !== String(submission.id_equipo)
            );
            return acc + (hasReviewFromAnotherTeam ? 1 : 0);
          }, 0);
          counts[assignmentKey] = reviewedSubmissions;
        }
        setReviewedSubmissionsByAssignment(counts);
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

  const openReview = (reviewId) => {
    if (!reviewId) return;
    window.history.pushState({}, '', `/reviews?revisionId=${reviewId}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <section>
      <h2>Feedback recibido</h2>
      <p style={{ color: '#555', fontSize: '0.9rem' }}>
        Consulta las revisiones que han recibido tus entregas.
      </p>

      <div style={reviewSelectorWrap}>
        <label style={sharedLabelStyle}>
          Tarea
          <select
            style={sharedInputStyle}
            value={assignmentId}
            onChange={(event) => setAssignmentId(event.target.value)}
          >
            {assignments.map((assignment) => (
              <option key={assignment.id} value={assignment.id}>
                {getAssignmentOptionLabel(
                  assignment,
                  reviewedSubmissionsByAssignment[String(assignment.id)] || 0
                )}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <p style={sharedErrorStyle}>{error}</p>}
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
                    <div>
                      <div>Nota: {review.nota_numerica ?? 'sin nota'}</div>
                      {review.equipo_revisor?.nombre && (
                        <div style={metaStyle}>Revisor: {review.equipo_revisor.nombre}</div>
                      )}
                      {review.comentario && <div style={metaStyle}>{review.comentario}</div>}
                    </div>
                    <button
                      type="button"
                      style={viewButtonStyle}
                      onClick={() => openReview(review.id)}
                    >
                      Ver revisión
                    </button>
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
  background: '#fafafa',
  display: 'flex',
  gap: '0.75rem',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'wrap'
};

const viewButtonStyle = {
  background: '#eef2ff',
  border: '1px solid #c7d2fe',
  color: '#1e3a8a',
  padding: '0.35rem 0.7rem',
  borderRadius: '999px',
  cursor: 'pointer',
  fontWeight: 600
};

const metaStyle = {
  fontSize: '0.85rem',
  color: '#666'
};
