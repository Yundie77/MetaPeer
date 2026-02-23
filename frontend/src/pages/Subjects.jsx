import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { getJson, postJson } from '../api.js';
import { buttons, forms, text } from '../styles/ui.js';
import { cardItem, cardList, formRow, sectionIntroText } from '../styles/pagePatterns.js';

export default function Subjects() {
  const { role } = useAuth();
  const canEdit = useMemo(() => role === 'ADMIN', [role]);

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
      <p style={sectionIntroText}>
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
            placeholder="Ej: Tecnología de Programación"
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

const formStyle = formRow;

const labelStyle = forms.label;

const inputStyle = {
  ...forms.input,
  padding: '0.5rem 0.7rem',
  minWidth: '360px'
};

const buttonStyle = buttons.primary;

const errorStyle = text.error;

const listStyle = {
  ...cardList,
  gap: '0.75rem'
};

const cardStyle = cardItem;

const codeStyle = text.meta;
