import React, { useEffect, useState } from 'react';
import { get, post } from '../api.js';

export default function Assignments({ onNavigate }) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await get('/assignments');
        setAssignments(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!title.trim()) {
      setError('El título es obligatorio.');
      return;
    }

    try {
      setError('');
      const body = { title: title.trim(), due_date: dueDate.trim() || null };
      const created = await post('/assignments', body);
      setAssignments((prev) => [created, ...prev]);
      setTitle('');
      setDueDate('');
    } catch (err) {
      setError(err.message);
    }
  };

  const goToSubmissions = (assignmentId) => {
    if (onNavigate) {
      onNavigate(`/submissions?assignmentId=${assignmentId}`);
    }
  };

  return (
    <section>
      <h2>Asignaciones</h2>
      <form onSubmit={handleSubmit} style={formStyle}>
        <input
          style={inputStyle}
          placeholder="Título"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <input
          style={inputStyle}
          type="date"
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
        />
        <button type="submit" style={submitStyle}>Crear</button>
      </form>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {loading ? (
        <p>Cargando asignaciones...</p>
      ) : assignments.length === 0 ? (
        <p>No hay asignaciones todavía.</p>
      ) : (
        <ul style={listStyle}>
          {assignments.map((assignment) => (
            <li key={assignment.id} style={cardStyle}>
              <div>
                <strong>{assignment.title}</strong>
                {assignment.due_date && (
                  <span style={{ display: 'block', fontSize: '0.85rem', color: '#555' }}>
                    Fecha límite: {assignment.due_date}
                  </span>
                )}
              </div>
              <button type="button" style={smallButtonStyle} onClick={() => goToSubmissions(assignment.id)}>
                Ver entregas
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
