import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { getJson } from '../api.js';
import {
  labelStyle as sharedLabelStyle,
  inputStyle as sharedInputStyle,
  reviewSelectorWrap,
  errorStyle as sharedErrorStyle,
  statusBadgePending,
  statusBadgeGraded
} from './reviews/stylesReview.js';
import { buttons, helpers, lists, surfaces, text } from '../styles/ui.js';
import { sectionIntroText } from '../styles/pagePatterns.js';

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

const resolveReviewStatus = (review) => {
  const hasGrade = review?.nota_numerica !== null && review?.nota_numerica !== undefined;
  if (hasGrade) {
    return { label: 'Con nota', style: statusBadgeGraded };
  }
  return { label: 'Pendiente', style: statusBadgePending };
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
      <p style={sectionIntroText}>
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
                {(reviews[submission.id] || []).map((review) => {
                  const status = resolveReviewStatus(review);
                  return (
                    <li key={review.id} style={innerCardStyle}>
                      <div>
                        <div>Nota: {review.nota_numerica ?? 'sin nota'}</div>
                        {review.equipo_revisor?.nombre && (
                          <div style={metaStyle}>Revisor: {review.equipo_revisor.nombre}</div>
                        )}
                        {review.comentario && <div style={metaStyle}>{review.comentario}</div>}
                      </div>
                      <div style={reviewActionsStyle}>
                        <span style={status.style}>{status.label}</span>
                        <button
                          type="button"
                          style={viewButtonStyle}
                          onClick={() => openReview(review.id)}
                        >
                          Ver revisión
                        </button>
                      </div>
                    </li>
                  );
                })}
                {(reviews[submission.id] || []).length === 0 && <li style={metaStyle}>Sin revisiones aún.</li>}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const listStyle = lists.stackList;

const cardStyle = surfaces.card;

const innerListStyle = {
  ...lists.denseList,
  marginTop: '0.75rem',
};

const innerCardStyle = {
  ...surfaces.cardMuted,
  display: 'flex',
  gap: '0.75rem',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'wrap'
};

const viewButtonStyle = {
  ...buttons.linkPill,
  padding: '0.35rem 0.7rem',
  cursor: 'pointer',
};

const reviewActionsStyle = helpers.row('0.5rem', 'center');

const metaStyle = text.meta;
