import React, { useEffect, useState } from 'react';
import { get, post } from '../api.js';

export default function Reviews({ submissionId, assignmentId, onNavigate }) {
  const [reviews, setReviews] = useState([]);
  const [reviewer, setReviewer] = useState('');
  const [scoreQ1, setScoreQ1] = useState('');
  const [scoreQ2, setScoreQ2] = useState('');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      if (!submissionId) {
        setReviews([]);
        return;
      }
      try {
        setLoading(true);
        setError('');
        const data = await get(`/reviews?submissionId=${submissionId}`);
        setReviews(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [submissionId]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!submissionId) {
      setError('Selecciona una entrega primero.');
      return;
    }
    if (!reviewer.trim()) {
      setError('El revisor es obligatorio.');
      return;
    }

    try {
      setError('');
      const created = await post('/reviews', {
        submission_id: Number(submissionId),
        reviewer: reviewer.trim(),
        score_q1: Number(scoreQ1),
        score_q2: Number(scoreQ2),
        comment: comment.trim()
      });
      setReviews((prev) => [created, ...prev]);
      setReviewer('');
      setScoreQ1('');
      setScoreQ2('');
      setComment('');
    } catch (err) {
      setError(err.message);
    }
  };

  if (!submissionId) {
    return <p>Selecciona una entrega para revisar.</p>;
  }

  return (
    <section>
      <h2>Revisiones</h2>
      <form onSubmit={handleSubmit} style={formStyle}>
        <input
          style={inputStyle}
          placeholder="Revisor"
          value={reviewer}
          onChange={(event) => setReviewer(event.target.value)}
        />
        <input
          style={inputStyle}
          type="number"
          step="0.1"
          placeholder="Puntaje Q1"
          value={scoreQ1}
          onChange={(event) => setScoreQ1(event.target.value)}
        />
        <input
          style={inputStyle}
          type="number"
          step="0.1"
          placeholder="Puntaje Q2"
          value={scoreQ2}
          onChange={(event) => setScoreQ2(event.target.value)}
        />
        <input
          style={{ ...inputStyle, flex: 1 }}
          placeholder="Comentario"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
        />
        <button type="submit" style={submitStyle}>Guardar</button>
      </form>
      {assignmentId && (
        <button
          type="button"
          style={backButtonStyle}
          onClick={() => onNavigate && onNavigate(`/submissions?assignmentId=${assignmentId}`)}
        >
          Volver a entregas
        </button>
      )}
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {loading ? (
        <p>Cargando revisiones...</p>
      ) : reviews.length === 0 ? (
        <p>No hay revisiones registradas.</p>
      ) : (
        <ul style={listStyle}>
          {reviews.map((review) => (
            <li key={review.id} style={cardStyle}>
              <div>
                <strong>{review.reviewer}</strong>
                <div style={{ fontSize: '0.85rem', color: '#555' }}>
                  P1: {review.score_q1} | P2: {review.score_q2}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#0078d4' }}>Final: {review.final}</div>
                {review.comment && (
                  <div style={{ fontSize: '0.8rem', color: '#777' }}>{review.comment}</div>
                )}
                <div style={{ fontSize: '0.75rem', color: '#888' }}>Creado: {review.created_at}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const formStyle = {
  display: 'flex',
  gap: '0.5rem',
  marginBottom: '1rem',
  alignItems: 'center',
  flexWrap: 'wrap'
};

const inputStyle = {
  padding: '0.4rem 0.6rem',
  border: '1px solid #ccc',
  borderRadius: '4px'
};

const submitStyle = {
  background: '#0078d4',
  color: '#fff',
  border: 'none',
  padding: '0.45rem 0.9rem',
  borderRadius: '4px',
  cursor: 'pointer'
};

const backButtonStyle = {
  background: '#e0e0e0',
  border: 'none',
  padding: '0.35rem 0.75rem',
  borderRadius: '4px',
  cursor: 'pointer',
  marginBottom: '1rem'
};

const listStyle = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem'
};

const cardStyle = {
  padding: '0.75rem 1rem',
  border: '1px solid #e0e0e0',
  borderRadius: '6px',
  background: '#fafafa'
};
