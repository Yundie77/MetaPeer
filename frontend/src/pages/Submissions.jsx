import React, { useEffect, useState } from 'react';
import { get, post } from '../api.js';

export default function Submissions({ assignmentId, onNavigate }) {
  const [submissions, setSubmissions] = useState([]);
  const [author, setAuthor] = useState('');
  const [zipName, setZipName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      if (!assignmentId) {
        setSubmissions([]);
        return;
      }
      try {
        setLoading(true);
        setError('');
        const data = await get(`/submissions?assignmentId=${assignmentId}`);
        setSubmissions(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [assignmentId]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!assignmentId) {
      setError('Selecciona una asignación antes de crear entregas.');
      return;
    }
    if (!author.trim() || !zipName.trim()) {
      setError('Autor y nombre de zip son obligatorios.');
      return;
    }

    try {
      setError('');
      const created = await post('/submissions', {
        assignment_id: Number(assignmentId),
        author: author.trim(),
        zip_name: zipName.trim()
      });
      setSubmissions((prev) => [created, ...prev]);
      setAuthor('');
      setZipName('');
    } catch (err) {
      setError(err.message);
    }
  };

  const goToReviews = (submissionId) => {
    if (onNavigate) {
      onNavigate(`/reviews?submissionId=${submissionId}&assignmentId=${assignmentId || ''}`);
    }
  };

  if (!assignmentId) {
    return <p>Elige una asignación desde la lista para ver sus entregas.</p>;
  }

  return (
    <section>
      <h2>Entregas</h2>
      <form onSubmit={handleSubmit} style={formStyle}>
        <input
          style={inputStyle}
          placeholder="Autor"
          value={author}
          onChange={(event) => setAuthor(event.target.value)}
        />
        <input
          style={inputStyle}
          placeholder="Nombre del ZIP"
          value={zipName}
          onChange={(event) => setZipName(event.target.value)}
        />
        <button type="submit" style={submitStyle}>Crear entrega</button>
      </form>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {loading ? (
        <p>Cargando entregas...</p>
      ) : submissions.length === 0 ? (
        <p>No hay entregas para esta asignación.</p>
      ) : (
        <ul style={listStyle}>
          {submissions.map((submission) => (
            <li key={submission.id} style={cardStyle}>
              <div>
                <strong>{submission.author}</strong>
                <div style={{ fontSize: '0.85rem', color: '#555' }}>ZIP: {submission.zip_name}</div>
                <div style={{ fontSize: '0.8rem', color: '#777' }}>Creado: {submission.created_at}</div>
              </div>
              <button type="button" style={smallButtonStyle} onClick={() => goToReviews(submission.id)}>
                Ver revisiones
              </button>
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
  alignItems: 'center'
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

const listStyle = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem'
};

const cardStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '0.75rem 1rem',
  border: '1px solid #e0e0e0',
  borderRadius: '6px',
  background: '#fafafa'
};

const smallButtonStyle = {
  background: '#61dafb',
  border: 'none',
  padding: '0.35rem 0.75rem',
  borderRadius: '4px',
  cursor: 'pointer',
  fontWeight: 600
};
