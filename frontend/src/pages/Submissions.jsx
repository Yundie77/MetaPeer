import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { getJson, postJson } from '../api.js';

export default function Submissions() {
  const { user, role } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [assignmentId, setAssignmentId] = useState('');
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState('');
  const [zipName, setZipName] = useState('');
  const [saving, setSaving] = useState(false);

  const isStudent = useMemo(() => role === 'ALUM', [role]);

  useEffect(() => {
    const loadAssignments = async () => {
      try {
        setListLoading(true);
        setError('');
        const data = await getJson('/assignments');
        setAssignments(data);
        if (data.length > 0) {
          setAssignmentId(String(data[0].id));
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setListLoading(false);
      }
    };

    loadAssignments();
  }, []);

  useEffect(() => {
    if (!assignmentId) {
      setSubmissions([]);
      return;
    }

    const loadSubmissions = async () => {
      try {
        setLoading(true);
        setError('');
        const data = await getJson(`/submissions?assignmentId=${assignmentId}`);
        setSubmissions(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadSubmissions();
  }, [assignmentId]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!isStudent) {
      setError('Solo los alumnos pueden registrar entregas.');
      return;
    }
    if (!assignmentId) {
      setError('Selecciona una tarea primero.');
      return;
    }
    if (!zipName.trim()) {
      setError('El nombre del ZIP es obligatorio.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      const created = await postJson('/submissions', {
        assignmentId: Number(assignmentId),
        authorUserId: user.id,
        zipName: zipName.trim()
      });
      setSubmissions((prev) => {
        const idx = prev.findIndex((item) => item.id === created.id);
        if (idx >= 0) {
          const clone = [...prev];
          clone[idx] = created;
          return clone;
        }
        return [created, ...prev];
      });
      setZipName('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <h2>Mis entregas</h2>
      <p style={{ color: '#555', fontSize: '0.9rem' }}>
        Selecciona una tarea para ver tus envíos registrados y registrar uno nuevo.
      </p>

      <label style={labelStyle}>
        Tarea
        <select
          style={inputStyle}
          value={assignmentId}
          onChange={(event) => setAssignmentId(event.target.value)}
          disabled={listLoading}
        >
          {assignments.map((assignment) => (
            <option key={assignment.id} value={assignment.id}>
              {assignment.titulo}
            </option>
          ))}
        </select>
      </label>

      {isStudent && (
        <form onSubmit={handleSubmit} style={formStyle}>
          <label style={labelStyle}>
            Nombre del ZIP
            <input
              style={inputStyle}
              value={zipName}
              onChange={(event) => setZipName(event.target.value)}
              placeholder="miproyecto.zip"
              disabled={saving}
            />
          </label>
          <button type="submit" style={buttonStyle} disabled={saving}>
            {saving ? 'Guardando...' : 'Registrar entrega'}
          </button>
        </form>
      )}

      {error && <p style={errorStyle}>{error}</p>}

      {loading ? (
        <p>Cargando entregas...</p>
      ) : submissions.length === 0 ? (
        <p>No hay entregas para esta tarea.</p>
      ) : (
        <ul style={listStyle}>
          {submissions.map((submission) => (
            <li key={submission.id} style={cardStyle}>
              <div>
                <strong>{submission.nombre_zip}</strong>
                <div style={metaStyle}>Subida: {submission.fecha_subida || 'sin fecha'}</div>
                {submission.autor_nombre && (
                  <div style={metaStyle}>
                    Autor: {submission.autor_nombre} ({submission.autor_correo})
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const formStyle = {
  marginTop: '1.5rem',
  display: 'flex',
  gap: '1rem',
  alignItems: 'flex-end'
};

const labelStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
  fontWeight: 600,
  maxWidth: '320px'
};

const inputStyle = {
  padding: '0.5rem 0.65rem',
  borderRadius: '4px',
  border: '1px solid #ccc'
};

const buttonStyle = {
  padding: '0.6rem 0.9rem',
  background: '#0b74de',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer'
};

const errorStyle = {
  color: 'crimson',
  margin: '1rem 0'
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
  padding: '1rem',
  border: '1px solid #e0e0e0',
  borderRadius: '8px',
  background: '#fff'
};

const metaStyle = {
  fontSize: '0.85rem',
  color: '#666'
};
