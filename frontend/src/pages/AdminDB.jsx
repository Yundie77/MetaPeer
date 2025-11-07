import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { getJson, postJson } from '../api.js';

export default function AdminDB() {
  const { role } = useAuth();
  const isAdmin = useMemo(() => role === 'ADMIN', [role]);
  const [subjects, setSubjects] = useState([]);
  const [subjectId, setSubjectId] = useState('');
  const [csvText, setCsvText] = useState('');
  const [selectedFileName, setSelectedFileName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [readingFile, setReadingFile] = useState(false);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadSubjects = async () => {
      try {
        setLoading(true);
        setError('');
        const data = await getJson('/asignaturas');
        setSubjects(data);
        if (data.length > 0) {
          setSubjectId(String(data[0].id));
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    if (isAdmin) {
      loadSubjects();
    }
  }, [isAdmin]);

  const handleFileChange = (event) => {
    const file = event.target.files && event.target.files[0];
    setSummary(null);
    if (!file) {
      setCsvText('');
      setSelectedFileName('');
      return;
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Selecciona un archivo con extensión .csv.');
      setCsvText('');
      setSelectedFileName('');
      return;
    }

    setReadingFile(true);
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const text = typeof loadEvent.target?.result === 'string' ? loadEvent.target.result : '';
      setCsvText(text);
      setSelectedFileName(file.name);
      setError('');
      setReadingFile(false);
    };
    reader.onerror = () => {
      setError('No pudimos leer el archivo seleccionado.');
      setCsvText('');
      setSelectedFileName('');
      setReadingFile(false);
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!csvText.trim()) {
      setError('Selecciona un archivo CSV antes de importar.');
      return;
    }
    if (!subjectId) {
      setError('Selecciona una asignatura.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      const result = await postJson('/admin/import-roster', {
        csvText,
        asignaturaId: Number(subjectId)
      });
      setSummary(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return <p>Solo los administradores pueden acceder a esta sección.</p>;
  }

  return (
    <section>
      <h2>Importar alumnos (CSV)</h2>
      <p style={{ color: '#555', fontSize: '0.9rem' }}>
        Pega el CSV exportado desde la plataforma. Se crearán usuarios y grupos automáticamente.
      </p>

      <form onSubmit={handleSubmit} style={formStyle}>
        <label style={labelStyle}>
          Asignatura
          <select
            style={inputStyle}
            value={subjectId}
            onChange={(event) => setSubjectId(event.target.value)}
            disabled={loading}
          >
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.nombre}
              </option>
            ))}
          </select>
        </label>
        <label style={labelStyle}>
          Archivo CSV
          <input
            style={inputStyle}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            disabled={saving || readingFile}
          />
          {selectedFileName && <span style={fileInfoStyle}>Seleccionado: {selectedFileName}</span>}
        </label>
        <button type="submit" style={buttonStyle} disabled={saving || readingFile}>
          {saving ? 'Importando...' : readingFile ? 'Leyendo archivo...' : 'Importar CSV'}
        </button>
      </form>

      {error && <p style={errorStyle}>{error}</p>}

      {summary && (
        <div style={summaryStyle}>
          <h3>Resumen</h3>
          <p>Alumnos creados: {summary.alumnosCreados}</p>
          <p>Equipos creados: {summary.equiposCreados}</p>
          <p>Membresías nuevas: {summary.membresiasInsertadas}</p>
          <p>Filas ignoradas: {summary.ignoradas}</p>
        </div>
      )}
    </section>
  );
}

const formStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
  margin: '1.5rem 0'
};

const labelStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
  fontWeight: 600
};

const inputStyle = {
  padding: '0.6rem 0.75rem',
  border: '1px solid #ccc',
  borderRadius: '4px',
  fontFamily: 'inherit'
};

const buttonStyle = {
  padding: '0.6rem 0.9rem',
  background: '#0b74de',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  maxWidth: '180px'
};

const errorStyle = {
  color: 'crimson'
};

const fileInfoStyle = {
  fontSize: '0.85rem',
  color: '#555',
  marginTop: '0.35rem'
};

const summaryStyle = {
  marginTop: '1.5rem',
  padding: '1rem',
  borderRadius: '8px',
  border: '1px solid #d0d0d0',
  background: '#fafafa'
};
