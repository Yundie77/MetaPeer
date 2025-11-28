import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { API_BASE, getJson } from '../api.js';

export default function Submissions() {
  const { role, token } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [assignmentId, setAssignmentId] = useState('');
  const [submissions, setSubmissions] = useState([]);
  const [batchMeta, setBatchMeta] = useState(null);
  const [totalSubmissions, setTotalSubmissions] = useState(0);
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadingId, setDownloadingId] = useState(null);

  const isStudent = useMemo(() => role === 'ALUM', [role]);
  const isTeacher = useMemo(() => role === 'ADMIN' || role === 'PROF', [role]);

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

  const loadSubmissions = async (targetAssignmentId) => {
    if (!targetAssignmentId) {
      setSubmissions([]);
      setBatchMeta(null);
      setTotalSubmissions(0);
      return;
    }

    try {
      setLoading(true);
      setError('');
      const data = await getJson(`/submissions?assignmentId=${targetAssignmentId}`);
      const list = Array.isArray(data) ? data : data.submissions || [];
      setSubmissions(list);
      setBatchMeta(data.meta?.ultimaCarga || null);
      setTotalSubmissions(data.meta?.totalEntregas ?? list.length);
    } catch (err) {
      setError(err.message);
      setSubmissions([]);
      setBatchMeta(null);
      setTotalSubmissions(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubmissions(assignmentId);
  }, [assignmentId]);

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
      <h2>Entregas</h2>
      <p style={{ color: '#555', fontSize: '0.9rem' }}>
        El profesorado sube un ZIP con todas las entregas. El alumnado solo consulta y descarga.
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

      {isTeacher && batchMeta && (
        <div style={infoBox}>
          <p>
            Última carga: <strong>{formatDate(batchMeta.fecha_subida || batchMeta.fecha)}</strong> · ZIP:{' '}
            <strong>{batchMeta.nombre_zip}</strong>
          </p>
          <p>
            Entregas detectadas en la carga: {batchMeta.total_equipos ?? '—'}. Guardadas en el sistema: {totalSubmissions}.
          </p>
        </div>
      )}

      {isStudent && (
        <div style={infoBox}>
          <p>Las entregas ya no se suben aquí. El profesor cargará el ZIP general de la tarea.</p>
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
                {submission.equipo_nombre && <div style={metaStyle}>Equipo: {submission.equipo_nombre}</div>}
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
  background: '#fff',
  display: 'flex',
  justifyContent: 'space-between',
  gap: '1rem',
  alignItems: 'center'
};

const metaStyle = {
  fontSize: '0.85rem',
  color: '#666'
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
