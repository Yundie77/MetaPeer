import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { getJson, postJson } from '../api.js';

export default function Subjects() {
  const { role } = useAuth();
  const canEdit = useMemo(() => role === 'ADMIN' || role === 'PROF', [role]);

  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!canEdit) {
      return;
    }
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const data = await getJson('/asignaturas');
        setSubjects(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [canEdit]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!name.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }
    try {
      setSaving(true);
      setError('');
      const created = await postJson('/asignaturas', {
        nombre: name.trim()
      });
      setSubjects((prev) => [created, ...prev]);
      setName('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!canEdit) {
    return <p>No tienes permisos para administrar asignaturas.</p>;
  }

  return (
    <section>
      <h2>Asignaturas</h2>
      <p style={{ color: '#555', fontSize: '0.9rem' }}>
        Crea asignaturas para organizar tareas y equipos.
      </p>

      <form onSubmit={handleSubmit} style={formStyle}>
        <label style={labelStyle}>
          Nombre
          <input
            style={inputStyle}
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={saving}
            placeholder="Introducción a la programación"
          />
        </label>
        <button type="submit" style={buttonStyle} disabled={saving}>
          {saving ? 'Guardando...' : 'Crear asignatura'}
        </button>
      </form>

      {error && <p style={errorStyle}>{error}</p>}
      {loading ? (
        <p>Cargando asignaturas...</p>
      ) : subjects.length === 0 ? (
        <p>No hay asignaturas registradas.</p>
      ) : (
        <ul style={listStyle}>
          {subjects.map((subject) => (
            <li key={subject.id} style={cardStyle}>
              <strong>{subject.nombre}</strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const formStyle = {
  display: 'flex',
  gap: '1rem',
  alignItems: 'flex-end',
  margin: '1.5rem 0',
  flexWrap: 'wrap'
};

const labelStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
  fontWeight: 600
};

const inputStyle = {
  padding: '0.5rem 0.7rem',
  borderRadius: '4px',
  border: '1px solid #ccc',
  minWidth: '360px'
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
  color: 'crimson'
};

const listStyle = {
  listStyle: 'none',
  padding: 0,
  margin: '1.5rem 0',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem'
};

const cardStyle = {
  padding: '0.75rem 1rem',
  border: '1px solid #e0e0e0',
  borderRadius: '6px',
  background: '#fff',
  display: 'flex',
  justifyContent: 'space-between'
};

const codeStyle = {
  fontSize: '0.9rem',
  color: '#666'
};
