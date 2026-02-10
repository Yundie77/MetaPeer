import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getJson, postJson } from '../../api.js';
import ReviewViewer from './ReviewViewer.jsx';
import { normalizePath } from '../../utils/fileTreeHelpers.js';
import { readFromURL, writeToURL } from '../../utils/permalink.js';
import {
  panelStyle,
  reviewsLayout,
  taskListStyle,
  taskButtonStyle,
  reviewFormStyle,
  reviewRightColumn,
  rubricFieldStyle,
  labelStyle,
  inputStyle,
  buttonStyle,
  errorStyle,
  successStyle,
  metaReviewPanel,
  miniMeta,
  statusList,
  statusItem
} from './styles.js';

const splitLabelDetail = (texto = '') => {
  const parts = texto.split('||DETAIL||');
  return {
    label: parts[0] || '',
    detail: parts.slice(1).join('||DETAIL||') || ''
  };
};

const noteHelpStyle = {
  fontSize: '0.78rem',
  color: '#666',
  fontWeight: 500
};

const SCORE_MIN = 0;
const SCORE_MAX = 10;

const finalGradeInputStyle = {
  ...inputStyle,
  background: '#e4e7eb',
  color: '#1f2937',
  borderColor: '#9ca3af',
  fontWeight: 700
};

const formulaTextStyle = {
  fontSize: '0.85rem',
  color: '#374151',
  margin: 0
};

const formatMetaDate = (value) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
};

function normalizeScoreInput(rawValue) {
  const value = String(rawValue ?? '').trim().replace(',', '.');
  if (value === '') {
    return '';
  }
  if (!/^\d+(\.\d{0,2})?$/.test(value)) {
    return null; // hasta dos decimales
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  if (parsed < SCORE_MIN || parsed > SCORE_MAX) {
    return null;
  }
  return value;
}

export default function StudentReviews({ user }) {
  const [tasks, setTasks] = useState([]);
  const [selected, setSelected] = useState(null);
  const [rubric, setRubric] = useState([]);
  const [scores, setScores] = useState({});
  const [comment, setComment] = useState('');
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [loadingRubric, setLoadingRubric] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pendingFile, setPendingFile] = useState(null);
  const [metaReviewInfo, setMetaReviewInfo] = useState(null);
  const [metaReviewLoading, setMetaReviewLoading] = useState(false);
  const [metaReviewError, setMetaReviewError] = useState('');
  const [deepLink] = useState(() => readFromURL());
  const deepLinkHandledRef = useRef(false);
  const handleViewerOpened = useCallback(() => setPendingFile(null), []);

  useEffect(() => {
    const loadTasks = async () => {
      try {
        setLoadingTasks(true);
        setError('');
        const data = await getJson('/my-review-tasks');
        setTasks(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingTasks(false);
      }
    };
    loadTasks();
  }, []);

  const handleSelectTask = useCallback(
    async (task, options = {}) => {
      if (!task) return;
      const { initialFile = null, preserveUrl = false } = options;
      setSelected(task);
      setScores(task.respuestas ? task.respuestas : {});
      setComment(task.comentario || '');
      setSuccess('');
      const normalizedInitial = initialFile?.fileId
        ? {
            fileId: String(initialFile.fileId),
            line: Number(initialFile.line) || 0
          }
        : initialFile?.path
        ? {
            path: normalizePath(initialFile.path),
            line: Number(initialFile.line) || 0
          }
        : null;
      setPendingFile(normalizedInitial);
      if (!preserveUrl) {
        writeToURL({ revisionId: task.id });
      }
      try {
        setLoadingRubric(true);
        const items = await getJson(`/assignments/${task.assignmentId}/rubrica`);
        setRubric(items);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingRubric(false);
      }
    },
    []
  );

  useEffect(() => {
    if (deepLinkHandledRef.current) return;
    if (!deepLink?.revisionId || tasks.length === 0) return;
    const target = tasks.find((task) => task.id === Number(deepLink.revisionId));
    if (!target) {
      deepLinkHandledRef.current = true;
      return;
    }
    deepLinkHandledRef.current = true;
    const initialFile = deepLink.fileId
      ? { fileId: deepLink.fileId, line: deepLink.line || 0 }
      : deepLink.path
      ? { path: normalizePath(deepLink.path), line: deepLink.line || 0 }
      : null;
    handleSelectTask(target, { initialFile, preserveUrl: true });
  }, [tasks, deepLink, handleSelectTask]);

  useEffect(() => {
    if (!selected?.id) {
      setMetaReviewInfo(null);
      setMetaReviewLoading(false);
      setMetaReviewError('');
      return;
    }

    let active = true;
    const loadMetaReview = async () => {
      try {
        setMetaReviewLoading(true);
        setMetaReviewError('');
        const data = await getJson(`/reviews/${selected.id}/meta`);
        if (!active) return;
        setMetaReviewInfo(data?.meta || null);
      } catch (err) {
        if (!active) return;
        setMetaReviewInfo(null);
        setMetaReviewError(err.message);
      } finally {
        if (active) {
          setMetaReviewLoading(false);
        }
      }
    };

    loadMetaReview();

    return () => {
      active = false;
    };
  }, [selected?.id]);

  const handleScoreChange = (clave, value) => {
    const normalized = normalizeScoreInput(value);
    if (normalized === null) {
      return;
    }
    setScores((prev) => ({
      ...prev,
      [clave]: normalized
    }));
  };

  const formulaText = useMemo(() => {
    if (!Array.isArray(rubric) || rubric.length === 0) {
      return 'Nota global = sin rúbrica disponible';
    }
    const parts = rubric.map((item) => {
      const label = splitLabelDetail(item.texto).label || item.texto || item.clave_item;
      const weight = Number(item.peso) || 0;
      return `${label} (${weight}%)`;
    });
    return `Nota final = ${parts.join(' + ')}`;
  }, [rubric]);

  const notaFinalCalculada = useMemo(() => {
    if (!Array.isArray(rubric) || rubric.length === 0) {
      return '';
    }
    let total = 0;
    for (const item of rubric) {
      const rawValue = scores[item.clave_item];
      if (rawValue === '' || rawValue === null || rawValue === undefined) {
        return '';
      }
      const parsed = Number(rawValue);
      if (!Number.isFinite(parsed) || parsed < SCORE_MIN || parsed > SCORE_MAX) {
        return '';
      }
      total += parsed * ((Number(item.peso) || 0) / 100);
    }
    return Number(total.toFixed(2));
  }, [scores, rubric]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selected) {
      setError('Selecciona una revisión primero.');
      return;
    }

    if (!Array.isArray(rubric) || rubric.length === 0) {
      setError('La rúbrica no está disponible para esta revisión.');
      return;
    }

    const normalizedScores = {};
    for (const item of rubric) {
      const rawValue = scores[item.clave_item];
      if (rawValue === '' || rawValue === null || rawValue === undefined) {
        setError(`Falta la nota para "${splitLabelDetail(item.texto).label || item.texto}".`);
        return;
      }
      const value = String(rawValue).trim().replace(',', '.');
      if (value === '') {
        setError(`Falta la nota para "${splitLabelDetail(item.texto).label || item.texto}".`);
        return;
      }
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) {
        setError(`La nota de "${splitLabelDetail(item.texto).label || item.texto}" no es válida.`);
        return;
      }
      if (parsed < SCORE_MIN || parsed > SCORE_MAX) {
        setError(
          `La nota de "${splitLabelDetail(item.texto).label || item.texto}" debe estar entre ${SCORE_MIN} y ${SCORE_MAX}.`
        );
        return;
      }
      normalizedScores[item.clave_item] = parsed;
    }

    if (notaFinalCalculada === '') {
      setError('No se pudo calcular la nota final con los criterios de la rúbrica.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccess('');
      await postJson('/reviews', {
        submissionId: selected.submissionId,
        reviewerUserId: user.id,
        respuestasJson: normalizedScores,
        comentario: comment,
        notaNumerica: notaFinalCalculada
      });
      setSuccess('Revisión guardada correctamente.');
      window.alert('Revisión guardada correctamente.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={panelStyle}>
      <h3>Mis revisiones asignadas</h3>
      {error && <p style={errorStyle}>{error}</p>}
      {success && <p style={successStyle}>{success}</p>}
      {loadingTasks ? (
        <p>Cargando tareas de revisión...</p>
      ) : tasks.length === 0 ? (
        <p>No tienes revisiones pendientes.</p>
      ) : (
        <div style={reviewsLayout}>
          <ul style={taskListStyle}>
            {tasks.map((task) => (
              <li key={task.id}>
                <button
                  type="button"
                  style={taskButtonStyle(selected?.id === task.id)}
                  onClick={() => handleSelectTask(task)}
                >
                  {task.assignmentTitle} · {task.submissionZip}
                </button>
              </li>
            ))}
          </ul>
          {selected && (
            <div style={reviewRightColumn}>
              <ReviewViewer
                revisionId={selected.id}
                initialFileId={pendingFile?.fileId || ''}
                initialPath={pendingFile?.path || ''}
                initialLine={pendingFile?.line || 0}
                onFileOpened={handleViewerOpened}
              />
              <section style={metaReviewPanel}>
                <strong>Meta-revisión del profesor</strong>
                {metaReviewLoading ? (
                  <p style={miniMeta}>Cargando meta-revisión...</p>
                ) : metaReviewError ? (
                  <p style={errorStyle}>{metaReviewError}</p>
                ) : metaReviewInfo ? (
                  <ul style={statusList}>
                    <li style={statusItem}>
                      <div style={{ minWidth: '240px', flex: 1 }}>
                        <div style={miniMeta}>
                          Nota final:{' '}
                          {metaReviewInfo.nota_final !== null && metaReviewInfo.nota_final !== undefined
                            ? metaReviewInfo.nota_final
                            : 'Sin nota'}
                        </div>
                        <div style={miniMeta}>
                          Observación: {metaReviewInfo.observacion?.trim() || 'Sin observación'}
                        </div>
                        <div style={miniMeta}>
                          Fecha de registro: {formatMetaDate(metaReviewInfo.fecha_registro)}
                        </div>
                        {(metaReviewInfo?.profesor?.nombre || metaReviewInfo?.profesor?.correo) && (
                          <div style={miniMeta}>
                            Profesor: {metaReviewInfo.profesor.nombre || metaReviewInfo.profesor.correo}
                          </div>
                        )}
                      </div>
                    </li>
                  </ul>
                ) : (
                  <p style={miniMeta}>Sin meta-revisión del profesor</p>
                )}
              </section>
              <form onSubmit={handleSubmit} style={reviewFormStyle}>
                {loadingRubric ? (
                  <p>Cargando rúbrica...</p>
                ) : (
                  <>
                    {rubric.map((item) => (
                      <div key={item.id} style={rubricFieldStyle}>
                        <label style={labelStyle}>
                          {splitLabelDetail(item.texto).label || item.texto}
                          {splitLabelDetail(item.texto).detail && (
                            <small style={{ color: '#555', whiteSpace: 'pre-wrap' }}>
                              {splitLabelDetail(item.texto).detail}
                            </small>
                          )}
                          <input
                            style={inputStyle}
                            type="number"
                            step="0.5"
                            min={String(SCORE_MIN)}
                            max={String(SCORE_MAX)}
                            placeholder={`${SCORE_MIN}-${SCORE_MAX}`}
                            value={scores[item.clave_item] ?? ''}
                            onChange={(event) => handleScoreChange(item.clave_item, event.target.value)}
                          />
                        </label>
                      </div>
                    ))}
                  </>
                )}
                <label style={labelStyle}>
                  Nota final
                  <input
                    style={finalGradeInputStyle}
                    type="number"
                    step="0.5"
                    min={String(SCORE_MIN)}
                    max={String(SCORE_MAX)}
                    value={notaFinalCalculada}
                    readOnly
                    disabled
                  />
                </label>
                <p style={formulaTextStyle}>{formulaText}</p>
                <label style={labelStyle}>
                  Comentario general (opcional)
                  <textarea
                    style={{ ...inputStyle, minHeight: '80px' }}
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                  />
                </label>
                <button type="submit" style={buttonStyle} disabled={saving}>
                  {saving ? 'Guardando...' : 'Enviar revisión'}
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
