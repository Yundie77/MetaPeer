import React, { useEffect, useState } from 'react';
import { getJson } from '../api.js';

export default function Export() {
  const [assignments, setAssignments] = useState([]);
  const [assignmentId, setAssignmentId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
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
    load();
  }, []);

  const handleExport = async () => {
    if (!assignmentId) {
      setError('Selecciona una tarea.');
      return;
    }
    try {
      setProgress('Generando archivo...');
      const token = localStorage.getItem('metaPeerToken');
      const response = await fetch(
        `http://127.0.0.1:4000/api/export/grades?assignmentId=${assignmentId}&format=csv`,
        {
          headers: {
            Authorization: token ? `Bearer ${token}` : ''
          }
        }
      );
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'No pudimos exportar.');
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
      setProgress('Descarga iniciada.');
    } catch (err) {
      setError(err.message);
    } finally {
      setTimeout(() => setProgress(''), 3000);
    }
  };

  return (
    <section>
      <h2>Exportar calificaciones</h2>
      <p style={{ color: '#555', fontSize: '0.9rem' }}>
        El archivo incluye `nota_entrega` (media de revisiones), `bonus_review` (media de meta-revisión del profesor) y `nota_final` (igual a `nota_entrega`).
      </p>

      <label style={labelStyle}>
        Tarea
        <select
          style={inputStyle}
          value={assignmentId}
          onChange={(event) => setAssignmentId(event.target.value)}
          disabled={loading}
        >
          {assignments.map((assignment) => (
            <option key={assignment.id} value={assignment.id}>
              {assignment.titulo}
            </option>
          ))}
        </select>
      </label>

      <button type="button" style={buttonStyle} onClick={handleExport}>
        Descargar CSV
      </button>

      {error && <p style={errorStyle}>{error}</p>}
      {progress && <p style={progressStyle}>{progress}</p>}
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

const buttonStyle = {
  marginTop: '1rem',
  padding: '0.6rem 0.9rem',
  background: '#0b74de',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer'
};

const errorStyle = {
  color: 'crimson',
  marginTop: '1rem'
};

const progressStyle = {
  color: '#1f7a1f',
  marginTop: '1rem'
};
