import React, { useEffect, useMemo, useState } from 'react';
import { getJson } from '../../api.js';
import {
  panelStyle,
  labelStyle,
  inputStyle,
  errorStyle,
  statusList,
  statusItem,
  statusActions,
  statusBadgePending,
  statusBadgeSubmitted,
  statusBadgeGraded,
  linkPill,
  miniMeta
} from './styles.js';

const formatDate = (value) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
};

const resolveStatus = (review) => {
  if (!review?.submittedAt) {
    return { label: 'Pendiente', style: statusBadgePending };
  }
  if (review.grade !== null && review.grade !== undefined) {
    return { label: 'Con nota', style: statusBadgeGraded };
  }
  return { label: 'Enviada', style: statusBadgeSubmitted };
};

export default function MetaReviews() {
  const [assignments, setAssignments] = useState([]);
  const [assignmentId, setAssignmentId] = useState('');
  const [reviews, setReviews] = useState([]);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadAssignments = async () => {
      try {
        setLoadingAssignments(true);
        setError('');
        const data = await getJson('/assignments');
        setAssignments(data);
        if (data.length > 0) {
          setAssignmentId(String(data[0].id));
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingAssignments(false);
      }
    };
    loadAssignments();
  }, []);

  useEffect(() => {
    if (!assignmentId) {
      setReviews([]);
      return;
    }

    const loadReviews = async () => {
      try {
        setLoadingReviews(true);
        setError('');
        const summary = await getJson(`/assignments/${assignmentId}/assignment-summary`);
        setReviews(summary?.reviews || []);
      } catch (err) {
        setError(err.message);
        setReviews([]);
      } finally {
        setLoadingReviews(false);
      }
    };

    loadReviews();
  }, [assignmentId]);

  const openReview = (reviewId) => {
    if (!reviewId) return;
    window.history.pushState({}, '', `/reviews?revisionId=${reviewId}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const hasAssignments = useMemo(() => assignments.length > 0, [assignments]);

  return (
    <div style={{ ...panelStyle, marginTop: '2rem' }}>
      <h3>Revisiones</h3>
      <label style={labelStyle}>
        Tarea
        <select
          style={inputStyle}
          value={assignmentId}
          onChange={(event) => setAssignmentId(event.target.value)}
          disabled={loadingAssignments || !hasAssignments}
        >
          {assignments.map((assignment) => (
            <option key={assignment.id} value={assignment.id}>
              {assignment.titulo}
            </option>
          ))}
        </select>
      </label>

      {error && <p style={errorStyle}>{error}</p>}

      {loadingReviews ? (
        <p>Cargando revisiones...</p>
      ) : reviews.length === 0 ? (
        <p style={miniMeta}>No hay revisiones registradas para esta tarea.</p>
      ) : (
        <ul style={statusList}>
          {reviews.map((review) => {
            const status = resolveStatus(review);
            return (
              <li key={review.revisionId} style={statusItem}>
                <div>
                  <strong>Revisión #{review.revisionId}</strong>
                  <div style={miniMeta}>
                    Revisor: {review.reviewerName || review.reviewerTeamName || '—'} · Equipo:{' '}
                    {review.authorTeamName || '—'}
                  </div>
                  <div style={miniMeta}>
                    Asignada: {formatDate(review.assignedAt)} · Enviada: {formatDate(review.submittedAt)}
                    {review.grade !== null && review.grade !== undefined ? ` · Nota: ${review.grade}` : ''}
                  </div>
                  {review.comment ? <div style={miniMeta}>Comentario: {review.comment}</div> : null}
                </div>
                <div style={statusActions}>
                  <span style={status.style}>{status.label}</span>
                  <button type="button" style={linkPill} onClick={() => openReview(review.revisionId)}>
                    Ver revisión
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
