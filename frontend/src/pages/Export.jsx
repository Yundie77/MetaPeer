import React, { useEffect, useRef, useState } from 'react';
import { getJson } from '../api.js';

export default function Export() {
  const initialQueryRef = useRef(new URLSearchParams(window.location.search));
  const autoGenerateTriggeredRef = useRef(false);
  const initialAssignmentId = initialQueryRef.current.get('assignmentId');
  const autoGenerateOnLoad = initialQueryRef.current.get('autogen') === '1';

  const [assignments, setAssignments] = useState([]);
  const [assignmentId, setAssignmentId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [metaOutgoingText, setMetaOutgoingText] = useState('');
  const [incomingReviewsText, setIncomingReviewsText] = useState('');
  const [loadingMetaOutgoing, setLoadingMetaOutgoing] = useState(false);
  const [loadingIncomingReviews, setLoadingIncomingReviews] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await getJson('/assignments');
        setAssignments(data);
        if (data.length > 0 && initialAssignmentId) {
          const selected = data.find((assignment) => String(assignment.id) === String(initialAssignmentId));
          if (selected) {
            setAssignmentId(String(selected.id));
          } else {
            setAssignmentId(String(data[0].id));
          }
        } else if (data.length > 0) {
          setAssignmentId(String(data[0].id));
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [initialAssignmentId]);

  const fetchMetaOutgoingText = async (selectedAssignmentId) => {
    const data = await getJson(`/export/meta-outgoing?assignmentId=${selectedAssignmentId}`);
    return buildMetaOutgoingText(data);
  };

  const fetchIncomingReviewsText = async (selectedAssignmentId) => {
    const data = await getJson(`/export/incoming-reviews?assignmentId=${selectedAssignmentId}`);
    return buildIncomingReviewsText(data);
  };

  const downloadCsvFromText = (filename, text) => {
    if (!text) {
      setError('Primero genera el contenido.');
      return;
    }
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const buildMetaOutgoingText = (payload) => {
    const header = Array.isArray(payload?.header)
      ? payload.header
      : ['Alumno', 'id_rev_saliente', 'nota_meta_rev', 'comentario'];
    const rows = Array.isArray(payload?.rows) ? payload.rows : [];
    const lines = [header.join(';')];
    rows.forEach((row) => {
      lines.push([row.alumno ?? '', row.id_rev_saliente ?? '', row.nota_meta_rev ?? '', row.comentario ?? ''].join(';'));
    });
    return lines.join('\n');
  };

  const buildIncomingReviewsText = (payload) => {
    const header = Array.isArray(payload?.header)
      ? payload.header
      : ['Alumno', 'id_rev_entrante', 'nota_evaluada_rubrica', 'comentario'];
    const rows = Array.isArray(payload?.rows) ? payload.rows : [];
    const lines = [header.join(';')];
    rows.forEach((row) => {
      const criteriaValues = Array.isArray(row.criterios) ? row.criterios : [];
      lines.push(
        [row.alumno ?? '', row.id_rev_entrante ?? '', ...criteriaValues, row.nota_evaluada_rubrica ?? '', row.comentario ?? ''].join(
          ';'
        )
      );
    });
    return lines.join('\n');
  };

  const handleExportMetaOutgoing = async () => {
    if (!assignmentId) {
      setError('Selecciona una tarea.');
      return;
    }
    try {
      setError('');
      setProgress('Generando meta-revisión saliente...');
      setLoadingMetaOutgoing(true);
      setMetaOutgoingText(await fetchMetaOutgoingText(assignmentId));
      setProgress('Meta-revisión saliente generada.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingMetaOutgoing(false);
      setTimeout(() => setProgress(''), 3000);
    }
  };

  const handleExportIncomingReviews = async () => {
    if (!assignmentId) {
      setError('Selecciona una tarea.');
      return;
    }
    try {
      setError('');
      setProgress('Generando revisión entrante...');
      setLoadingIncomingReviews(true);
      setIncomingReviewsText(await fetchIncomingReviewsText(assignmentId));
      setProgress('Revisión entrante generada.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingIncomingReviews(false);
      setTimeout(() => setProgress(''), 3000);
    }
  };

  useEffect(() => {
    if (!autoGenerateOnLoad || loading || !assignmentId || autoGenerateTriggeredRef.current) {
      return;
    }
    autoGenerateTriggeredRef.current = true;
    let cancelled = false;
    const run = async () => {
      try {
        setError('');
        setProgress('Generando exportaciones...');
        setLoadingMetaOutgoing(true);
        setLoadingIncomingReviews(true);
        const [metaText, incomingText] = await Promise.all([
          fetchMetaOutgoingText(assignmentId),
          fetchIncomingReviewsText(assignmentId)
        ]);
        if (cancelled) return;
        setMetaOutgoingText(metaText);
        setIncomingReviewsText(incomingText);
        setProgress('Exportaciones generadas.');
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setLoadingMetaOutgoing(false);
          setLoadingIncomingReviews(false);
          setTimeout(() => setProgress(''), 3000);
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [assignmentId, autoGenerateOnLoad, loading]);

  return (
    <section>
      <h2>Exportar calificaciones</h2>
      <p style={{ color: '#555', fontSize: '0.9rem' }}>
        Genera y revisa el contenido antes de descargar cada CSV.
      </p>

      <label style={labelStyle}>
        Tarea
        <select
          style={inputStyle}
          value={assignmentId}
          onChange={(event) => {
            setAssignmentId(event.target.value);
            setMetaOutgoingText('');
            setIncomingReviewsText('');
          }}
          disabled={loading}
        >
          {assignments.map((assignment) => (
            <option key={assignment.id} value={assignment.id}>
              {assignment.titulo}
            </option>
          ))}
        </select>
      </label>

      <div style={actionsRowStyle}>
        <button type="button" style={buttonStyle} onClick={handleExportMetaOutgoing} disabled={loadingMetaOutgoing}>
          {loadingMetaOutgoing ? 'Generando...' : 'Generar meta-revision saliente'}
        </button>
        <button
          type="button"
          style={buttonStyle}
          onClick={handleExportIncomingReviews}
          disabled={loadingIncomingReviews}
        >
          {loadingIncomingReviews ? 'Generando...' : 'Generar revision entrante'}
        </button>
      </div>

      {metaOutgoingText && (
        <>
          <div style={previewHeaderStyle}>
            <h3 style={previewTitleStyle}>Meta-revision saliente</h3>
            <button
              type="button"
              style={downloadButtonStyle}
              onClick={() =>
                downloadCsvFromText(`meta-revision-saliente-assignment-${assignmentId}.csv`, metaOutgoingText)
              }
            >
              Descargar CSV
            </button>
          </div>
          <pre style={preStyle}>{metaOutgoingText}</pre>
        </>
      )}

      {incomingReviewsText && (
        <>
          <div style={previewHeaderStyle}>
            <h3 style={previewTitleStyle}>Revision entrante</h3>
            <button
              type="button"
              style={downloadButtonStyle}
              onClick={() =>
                downloadCsvFromText(`revision-entrante-assignment-${assignmentId}.csv`, incomingReviewsText)
              }
            >
              Descargar CSV
            </button>
          </div>
          <pre style={preStyle}>{incomingReviewsText}</pre>
        </>
      )}

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

const actionsRowStyle = {
  display: 'flex',
  gap: '0.75rem',
  flexWrap: 'wrap'
};

const previewTitleStyle = {
  margin: 0
};

const preStyle = {
  margin: 0,
  padding: '0.75rem',
  border: '1px solid #d1d5db',
  borderRadius: '6px',
  background: '#f9fafb',
  overflowX: 'auto',
  whiteSpace: 'pre'
};

const previewHeaderStyle = {
  marginTop: '1.25rem',
  marginBottom: '0.5rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.75rem',
  flexWrap: 'wrap'
};

const downloadButtonStyle = {
  padding: '0.4rem 0.75rem',
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer'
};

const progressStyle = {
  color: '#1f7a1f',
  marginTop: '1rem'
};
