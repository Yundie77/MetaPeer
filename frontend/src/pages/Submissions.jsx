import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { API_BASE, fetchJson, getJson } from '../api.js';

export default function Submissions() {
  const { user, role, token } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [assignmentId, setAssignmentId] = useState('');
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);

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

  const fileInputRef = useRef(null);

  const existingSubmission = useMemo(
    () => (isStudent ? submissions[0] || null : null),
    [isStudent, submissions]
  );

  const canUpload = isStudent && !existingSubmission;

  useEffect(() => {
    if (!canUpload && fileInputRef.current) {
      fileInputRef.current.value = '';
      setSelectedFile(null);
    }
  }, [canUpload]);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    setSelectedFile(file || null);
  };

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
    if (!selectedFile) {
      setError('Selecciona un archivo ZIP.');
      return;
    }
    if (!selectedFile.name.toLowerCase().endsWith('.zip')) {
      setError('El archivo debe tener extensión .zip.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      const formData = new FormData();
      formData.append('assignmentId', Number(assignmentId));
      formData.append('authorUserId', user.id);
      formData.append('zipFile', selectedFile);

      const created = await fetchJson('/submissions', {
        method: 'POST',
        body: formData
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
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async (submission) => {
    if (!submission?.id) return;
    if (!token) {
      setError('Tu sesión expiró, inicia sesión nuevamente.');
      return;
    }
    try {
      setDownloadingId(submission.id);
      setError('');
      const response = await fetch(`${API_BASE}/submissions/${submission.id}/download`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!response.ok) {
        let message = 'No pudimos descargar el archivo.';
        try {
          const data = await response.json();
          if (data?.error) {
            message = data.error;
          }
        } catch (_err) {
          message = response.statusText || message;
        }
        throw new Error(message);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = submission.nombre_zip || `entrega-${submission.id}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloadingId(null);
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
            Archivo ZIP
            <input
              ref={fileInputRef}
              style={inputStyle}
              type="file"
              accept=".zip"
              onChange={handleFileChange}
              disabled={saving || !canUpload}
            />
            {selectedFile && <span style={helperText}>{selectedFile.name}</span>}
          </label>
          <button type="submit" style={buttonStyle} disabled={saving || !canUpload}>
            {saving ? 'Subiendo...' : 'Subir entrega'}
          </button>
        </form>
      )}

      {isStudent && existingSubmission && (
        <div style={infoBox}>
          <p>
            ✅ Tu equipo subió <strong>{existingSubmission.nombre_zip}</strong> el{' '}
            {formatDate(existingSubmission.fecha_subida)}.
          </p>
          <p>No es posible subir una nueva entrega.</p>
          <button
            type="button"
            style={{
              ...linkButton,
              opacity: downloadingId === existingSubmission.id ? 0.6 : 1,
              cursor: downloadingId === existingSubmission.id ? 'wait' : 'pointer'
            }}
            onClick={() => handleDownload(existingSubmission)}
            disabled={downloadingId === existingSubmission.id}
          >
            {downloadingId === existingSubmission.id ? 'Descargando...' : 'Descargar ZIP'}
          </button>
        </div>
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
                <div style={metaStyle}>Subida: {formatDate(submission.fecha_subida)}</div>
                {submission.tamano_bytes ? (
                  <div style={metaStyle}>Tamaño: {formatBytes(submission.tamano_bytes)}</div>
                ) : null}
                {submission.autor_nombre && (
                  <div style={metaStyle}>
                    Autor: {submission.autor_nombre} ({submission.autor_correo})
                  </div>
                )}
              </div>
              {submission.id && (
                <button
                  type="button"
                  style={{
                    ...linkButton,
                    opacity: downloadingId === submission.id ? 0.6 : 1,
                    cursor: downloadingId === submission.id ? 'wait' : 'pointer'
                  }}
                  onClick={() => handleDownload(submission)}
                  disabled={downloadingId === submission.id}
                >
                  {downloadingId === submission.id ? 'Descargando...' : 'Descargar'}
                </button>
              )}
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

const helperText = {
  marginTop: '0.2rem',
  fontSize: '0.85rem',
  color: '#555'
};

const infoBox = {
  marginTop: '1rem',
  padding: '0.75rem 1rem',
  borderRadius: '8px',
  background: '#f0f9ff',
  border: '1px solid #c8e1ff',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.4rem',
  maxWidth: '420px'
};

const linkButton = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0.45rem 0.8rem',
  borderRadius: '4px',
  border: '1px solid #0b74de',
  background: '#fff',
  color: '#0b74de',
  textDecoration: 'none',
  fontWeight: 600,
  marginTop: '0.35rem',
  cursor: 'pointer'
};

function formatDate(value) {
  if (!value) return 'sin fecha';
  try {
    return new Date(value).toLocaleString('es-ES');
  } catch (_error) {
    return value;
  }
}

function formatBytes(bytes) {
  if (!bytes || Number(bytes) <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let idx = 0;
  let value = Number(bytes);
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  return `${value.toFixed(value >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
}
