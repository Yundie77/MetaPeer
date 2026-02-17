import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getJson } from '../api.js';
import {
  labelStyle as sharedLabelStyle,
  inputStyle as sharedInputStyle,
  reviewSelectorWrap,
  reviewSelectorDetail,
  errorStyle as sharedErrorStyle
} from './reviews/styles.js';

const formatSimpleDate = (value) => {
  if (!value) return 'sin fecha';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'sin fecha';
  return parsed.toLocaleDateString('es-ES');
};

const safeCount = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

const getAssignmentOptionLabel = (assignment) => {
  const title = assignment?.titulo || 'Sin título';
  const dueDate = formatSimpleDate(assignment?.fecha_entrega);
  const done = safeCount(assignment?.revisiones_realizadas);
  const expected = safeCount(assignment?.revisiones_esperadas);
  const metaDone = safeCount(assignment?.metarevisiones_realizadas);
  return `${title} · Entrega: ${dueDate} · Revisadas: ${done}/${expected} · Meta: ${metaDone}`;
};

const parseCsvTextToTable = (text) => {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { header: [], rows: [] };
  }

  const rows = lines.map((line) => line.split(';').map((cell) => cell.trim()));
  const [header, ...body] = rows;
  return { header, rows: body };
};

const CsvPreviewTable = ({ csvText }) => {
  const table = parseCsvTextToTable(csvText);
  if (table.header.length === 0) {
    return null;
  }

  return (
    <div style={tableWrapStyle}>
      <table style={tableStyle}>
        <thead>
          <tr>
            {table.header.map((cell, index) => (
              <th key={`header-${index}`} style={headerCellStyle}>
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={`row-${rowIndex}`}>
              {table.header.map((_, colIndex) => (
                <td key={`cell-${rowIndex}-${colIndex}`} style={bodyCellStyle}>
                  {row[colIndex] ?? ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

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
  const selectedAssignment = useMemo(
    () => assignments.find((assignment) => String(assignment.id) === String(assignmentId)) || null,
    [assignments, assignmentId]
  );

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

      <div style={reviewSelectorWrap}>
        <label style={sharedLabelStyle}>
          Tarea
          <select
            style={sharedInputStyle}
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
                {getAssignmentOptionLabel(assignment)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={actionsRowStyle}>
        <button type="button" style={buttonStyle} onClick={handleExportMetaOutgoing} disabled={loadingMetaOutgoing}>
          {loadingMetaOutgoing ? 'Generando...' : 'Generar CSV meta-revision saliente'}
        </button>
        <button
          type="button"
          style={buttonStyle}
          onClick={handleExportIncomingReviews}
          disabled={loadingIncomingReviews}
        >
          {loadingIncomingReviews ? 'Generando...' : 'Generar CSV revision entrante'}
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
          <CsvPreviewTable csvText={metaOutgoingText} />
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
          <CsvPreviewTable csvText={incomingReviewsText} />
        </>
      )}

      {error && <p style={sharedErrorStyle}>{error}</p>}
      {progress && <p style={progressStyle}>{progress}</p>}
    </section>
  );
}

const buttonStyle = {
  marginTop: '1rem',
  padding: '0.6rem 0.9rem',
  background: '#0b74de',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer'
};

const actionsRowStyle = {
  display: 'flex',
  gap: '0.75rem',
  flexWrap: 'wrap'
};

const previewTitleStyle = {
  margin: 0
};

const tableWrapStyle = {
  overflowX: 'auto',
  border: '1px solid #d1d5db',
  borderRadius: '6px',
  background: '#fff'
};

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse'
};

const headerCellStyle = {
  textAlign: 'left',
  padding: '0.55rem 0.65rem',
  borderBottom: '1px solid #d1d5db',
  background: '#f3f4f6',
  fontSize: '0.9rem'
};

const bodyCellStyle = {
  padding: '0.5rem 0.65rem',
  borderBottom: '1px solid #eef2f7',
  fontSize: '0.88rem',
  whiteSpace: 'nowrap'
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
