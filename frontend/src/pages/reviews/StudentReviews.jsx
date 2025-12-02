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
  successStyle
} from './styles.js';

const splitLabelDetail = (texto = '') => {
  const parts = texto.split('||DETAIL||');
  return {
    label: parts[0] || '',
    detail: parts.slice(1).join('||DETAIL||') || ''
  };
};

export default function StudentReviews({ user }) {
  const [tasks, setTasks] = useState([]);
  const [selected, setSelected] = useState(null);
  const [rubric, setRubric] = useState([]);
  const [scores, setScores] = useState({});
  const [comment, setComment] = useState('');
  const [grade, setGrade] = useState('');
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [loadingRubric, setLoadingRubric] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pendingFile, setPendingFile] = useState(null);
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
      setGrade(task.nota_numerica || '');
      setSuccess('');
      const normalizedInitial = initialFile?.path
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
    const initialFile = deepLink.path
      ? { path: normalizePath(deepLink.path), line: deepLink.line || 0 }
      : null;
    handleSelectTask(target, { initialFile, preserveUrl: true });
  }, [tasks, deepLink, handleSelectTask]);

  const handleScoreChange = (clave, value) => {
    setScores((prev) => ({
      ...prev,
      [clave]: value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selected) {
      setError('Selecciona una revisión primero.');
      return;
    }
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      await postJson('/reviews', {
        submissionId: selected.submissionId,
        reviewerUserId: user.id,
        respuestasJson: scores,
        comentario: comment,
        notaNumerica: grade ? Number(grade) : null
      });
      setSuccess('Revisión guardada correctamente.');
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
                initialPath={pendingFile?.path || ''}
                initialLine={pendingFile?.line || 0}
                onFileOpened={handleViewerOpened}
              />
              <form onSubmit={handleSubmit} style={reviewFormStyle}>
                {loadingRubric ? (
                  <p>Cargando rúbrica...</p>
                ) : (
                  rubric.map((item) => (
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
                          value={scores[item.clave_item] ?? ''}
                          onChange={(event) => handleScoreChange(item.clave_item, event.target.value)}
                        />
                      </label>
                    </div>
                  ))
                )}
                <label style={labelStyle}>
                  Nota global
                  <input
                    style={inputStyle}
                    type="number"
                    step="0.5"
                    value={grade}
                    onChange={(event) => setGrade(event.target.value)}
                  />
                </label>
                <label style={labelStyle}>
                  Comentario
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
