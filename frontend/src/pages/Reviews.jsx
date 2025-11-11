import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { API_BASE, getJson, postJson } from '../api.js';
import FileTree from '../components/FileTree.jsx';
import Breadcrumbs from '../components/Breadcrumbs.jsx';
import EditorPane from '../components/EditorPane.jsx';
import { ancestors, buildTreeFromPaths, collectDirPaths, normalizePath } from '../utils/fileTreeHelpers.js';
import { readFromURL, writeToURL } from '../utils/permalink.js';

function findBestPath(fileNames = [], requestedPath = '') {
  const normalizedTarget = normalizePath(requestedPath);
  if (!normalizedTarget) {
    return fileNames[0] || '';
  }

  if (fileNames.includes(normalizedTarget)) {
    return normalizedTarget;
  }

  const lowerTarget = normalizedTarget.toLowerCase();
  const lowerMatch = fileNames.find((name) => name.toLowerCase() === lowerTarget);
  if (lowerMatch) {
    return lowerMatch;
  }

  const targetParts = normalizedTarget.split('/');
  const lastSegment = targetParts[targetParts.length - 1] || '';
  if (!lastSegment) {
    return fileNames[0] || '';
  }
  const suffixMatch = fileNames.find((name) => name.toLowerCase().endsWith(lastSegment.toLowerCase()));
  return suffixMatch || fileNames[0] || '';
}

export default function Reviews() {
  const { user, role } = useAuth();
  const isStudent = useMemo(() => role === 'ALUM', [role]);
  const isReviewer = useMemo(() => role === 'ADMIN' || role === 'PROF', [role]);

  return (
    <section>
      <h2>Revisiones</h2>
      {isStudent && <StudentReviews user={user} />}
      {isReviewer && <MetaReviews />}
      {!isStudent && !isReviewer && <p>No tienes permisos para ver esta sección.</p>}
    </section>
  );
}

function StudentReviews({ user }) {
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
                <h4>
                  Revisando: <span style={{ color: '#0b74de' }}>{selected.submissionZip}</span>
                </h4>
                {loadingRubric ? (
                  <p>Cargando rúbrica...</p>
                ) : (
                  rubric.map((item) => (
                    <div key={item.id} style={rubricFieldStyle}>
                      <label style={labelStyle}>
                        {item.texto}
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

function ReviewViewer({ revisionId, initialPath = '', initialLine: presetLine = 0, onFileOpened }) {
  const { token } = useAuth();
  const [files, setFiles] = useState([]);
  const [meta, setMeta] = useState(null);
  const [expandedPaths, setExpandedPaths] = useState(new Set());
  const [currentPath, setCurrentPath] = useState('');
  const [initialLine, setInitialLine] = useState(0);
  const [fileData, setFileData] = useState({
    content: '',
    comments: [],
    isBinary: false,
    path: '',
    size: 0
  });
  const [treeLoading, setTreeLoading] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [error, setError] = useState('');
  const pendingFileRef = useRef(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!revisionId) {
      pendingFileRef.current = null;
      return;
    }
    if (initialPath) {
      pendingFileRef.current = { path: normalizePath(initialPath), line: presetLine || 0 };
    } else {
      pendingFileRef.current = null;
    }
  }, [revisionId, initialPath, presetLine]);

  useEffect(() => {
    if (!revisionId) {
      setFiles([]);
      setMeta(null);
      setExpandedPaths(new Set());
      setCurrentPath('');
      setError('');
      setFileData({
        content: '',
        comments: [],
        isBinary: false,
        path: '',
        size: 0
      });
      return;
    }

    const loadFiles = async () => {
      try {
        setTreeLoading(true);
        setError('');
        const data = await getJson(`/reviews/${revisionId}/files`);
        setFiles(data.files || []);
        setMeta({
          zipName: data.zipName,
          submissionId: data.submissionId
        });
        const names = (data.files || []).map((file) => normalizePath(file.path));
        setExpandedPaths(new Set(collectDirPaths(names)));
        setCurrentPath('');
        setInitialLine(0);
      } catch (err) {
        setFiles([]);
        setMeta(null);
        setError(err.message);
      } finally {
        setTreeLoading(false);
      }
    };

    loadFiles();
  }, [revisionId]);

  const fileNames = useMemo(() => files.map((file) => normalizePath(file.path)), [files]);
  const treeData = useMemo(() => buildTreeFromPaths(fileNames), [fileNames]);

  const commentsByLine = useMemo(() => {
    const map = new Map();
    (fileData.comments || []).forEach((comment) => {
      const lineNum = Number(comment.linea);
      if (!lineNum) return;
      const list = map.get(lineNum) || [];
      const author = comment.autor?.nombre || 'Revisor';
      const stamp = comment.creado_en ? ` · ${comment.creado_en}` : '';
      list.push(`${author}${stamp}: ${comment.contenido}`);
      map.set(lineNum, list);
    });
    return map;
  }, [fileData.comments]);

  const commentAnchors = useMemo(
    () =>
      (fileData.comments || []).map((comment) => ({
        id: comment.id,
        line: comment.linea,
        text: comment.contenido
      })),
    [fileData.comments]
  );

  const openFile = useCallback(
    async (pathValue, line = 0) => {
      if (!revisionId || !pathValue) return;
      const normalizedPath = normalizePath(pathValue);
      const safeLine = Number(line) || 0;
      try {
        setFileLoading(true);
        const data = await getJson(`/reviews/${revisionId}/file?path=${encodeURIComponent(normalizedPath)}`);
        setError('');
        setCurrentPath(data.path);
        setInitialLine(safeLine);
        setFileData({
          content: data.content || '',
          comments: data.comments || [],
          isBinary: data.isBinary,
          path: data.path,
          size: data.size || 0
        });
        setExpandedPaths((prev) => {
          const next = new Set(prev);
          ancestors(data.path).forEach((dir) => next.add(dir));
          return next;
        });
        writeToURL({
          revisionId,
          path: data.path,
          line: safeLine
        });
        if (onFileOpened) {
          onFileOpened(data.path, safeLine);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setFileLoading(false);
      }
    },
    [revisionId, onFileOpened]
  );

  useEffect(() => {
    if (!revisionId || files.length === 0) {
      return;
    }

    const pending = pendingFileRef.current;
    if (pending) {
      const normalized = normalizePath(pending.path || '');
      const line = pending.line || 0;
      const availablePath = findBestPath(fileNames, normalized);
      if (availablePath && availablePath !== normalized) {
        setError('No encontramos el archivo indicado. Abrimos el primero disponible.');
      }
      pendingFileRef.current = null;
      if (availablePath) {
        openFile(availablePath, availablePath === normalized ? line : 0);
      }
      return;
    }

    if (!currentPath && fileNames.length > 0) {
      const best = findBestPath(fileNames, fileNames[0]);
      openFile(best, 0);
    }
  }, [revisionId, files, fileNames, currentPath, openFile]);

  const toggleDir = (dir) => {
    if (!dir) return;
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(dir)) {
        next.delete(dir);
      } else {
        next.add(dir);
      }
      return next;
    });
  };

  const handleBreadcrumb = (segPath) => {
    if (!segPath) {
      setExpandedPaths(new Set(collectDirPaths(fileNames)));
      if (revisionId) {
        writeToURL({ revisionId });
      }
      return;
    }
    const dirs = ancestors(segPath);
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      dirs.forEach((dir) => next.add(dir));
      return next;
    });
  };

  const handleAddComment = async (line, text) => {
    if (!revisionId || !currentPath) return;
    const safeLine = Number(line) || 0;
    if (!safeLine) return;
    try {
      await postJson(`/reviews/${revisionId}/comments`, {
        path: currentPath,
        linea: safeLine,
        contenido: text
      });
      await openFile(currentPath, safeLine);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDownloadZip = async () => {
    if (!meta?.submissionId) return;
    if (!token) {
      setError('Tu sesión expiró, inicia sesión nuevamente.');
      return;
    }
    try {
      setDownloading(true);
      setError('');
      const response = await fetch(`${API_BASE}/submissions/${meta.submissionId}/download`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!response.ok) {
        let message = 'No pudimos descargar la entrega.';
        try {
          const data = await response.json();
          if (data?.error) message = data.error;
        } catch (_err) {
          message = response.statusText || message;
        }
        throw new Error(message);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = meta.zipName || `entrega-${meta.submissionId}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div style={viewerCard}>
      <div style={viewerHeader}>
        <strong>Archivos de la entrega</strong>
        {meta?.submissionId && (
          <button
            type="button"
            style={{
              ...linkButton,
              opacity: downloading ? 0.6 : 1,
              cursor: downloading ? 'wait' : 'pointer'
            }}
            onClick={handleDownloadZip}
            disabled={downloading}
          >
            {downloading ? 'Descargando...' : 'Descargar ZIP'}
          </button>
        )}
      </div>
      {error && <p style={errorStyle}>{error}</p>}
      {treeLoading ? (
        <p>Cargando archivos...</p>
      ) : files.length === 0 ? (
        <p>No hay archivos para esta entrega.</p>
      ) : (
        <div style={viewerGrid}>
          <aside style={viewerSidebar}>
            <FileTree
              nodes={treeData}
              selectedPath={currentPath}
              expandedPaths={expandedPaths}
              onToggleDir={toggleDir}
              onOpenFile={(filePath) => openFile(filePath, 0)}
            />
          </aside>
          <div style={viewerContent}>
            <Breadcrumbs path={currentPath} onNavigate={handleBreadcrumb} />
            {commentAnchors.length > 0 && (
              <div style={anchorBar}>
                Comentarios:
                {commentAnchors.map((comment) => (
                  <button
                    key={comment.id}
                    type="button"
                    style={anchorButton}
                    onClick={() => {
                      const targetLine = Number(comment.line) || 0;
                      setInitialLine(targetLine);
                      writeToURL({
                        revisionId,
                        path: currentPath,
                        line: targetLine
                      });
                    }}
                  >
                    L{comment.line}
                  </button>
                ))}
              </div>
            )}
            {fileLoading ? (
              <p>Cargando archivo...</p>
            ) : !currentPath ? (
              <p style={{ color: '#555' }}>Selecciona un archivo para revisarlo.</p>
            ) : fileData.isBinary ? (
              <div style={binaryWarning}>
                Este archivo es binario. Descárgalo para revisarlo por fuera.
              </div>
            ) : (
              <EditorPane
                path={currentPath}
                code={fileData.content}
                height="520px"
                initialLine={initialLine}
                commentsByLine={commentsByLine}
                onAddComment={handleAddComment}
                revisionId={revisionId}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MetaReviews() {
  const [assignments, setAssignments] = useState([]);
  const [assignmentId, setAssignmentId] = useState('');
  const [mapData, setMapData] = useState([]);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [error, setError] = useState('');
  const [metaInputs, setMetaInputs] = useState({});
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const loadAssignments = async () => {
      try {
        setLoadingAssignments(true);
        const data = await getJson('/assignments');
        setAssignments(data);
        if (data.length > 0) {
          setAssignmentId(String(data[0].id));
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingAssignments(false);
      }
    };
    loadAssignments();
  }, []);

  useEffect(() => {
    if (!assignmentId) {
      setMapData([]);
      return;
    }

    const loadReviews = async () => {
      try {
        setLoadingReviews(true);
        setError('');
        setSuccess('');
        const map = await getJson(`/assignments/${assignmentId}/assignment-map`);
        const pairs = map.pairs || [];

        const reviewDetails = [];
        for (const pair of pairs) {
          for (const submissionId of pair.entregas) {
            const reviews = await getJson(`/reviews?submissionId=${submissionId}`);
            reviewDetails.push(...reviews);
          }
        }
        setMapData(reviewDetails);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingReviews(false);
      }
    };

    loadReviews();
  }, [assignmentId]);

  const handleMetaChange = (reviewId, field, value) => {
    setMetaInputs((prev) => ({
      ...prev,
      [reviewId]: {
        ...(prev[reviewId] || {}),
        [field]: value
      }
    }));
  };

  const handleSubmitMeta = async (reviewId) => {
    const payload = metaInputs[reviewId];
    if (!payload || (!payload.nota && !payload.observacion)) {
      setError('Ingrese al menos una nota u observación para la meta-revisión.');
      return;
    }
    try {
      await postJson(`/reviews/${reviewId}/meta`, {
        nota_calidad: payload.nota ? Number(payload.nota) : null,
        observacion: payload.observacion || ''
      });
      setSuccess('Meta-revisión guardada.');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ ...panelStyle, marginTop: '2rem' }}>
      <h3>Meta-evaluación</h3>
      <label style={labelStyle}>
        Tarea
        <select
          style={inputStyle}
          value={assignmentId}
          onChange={(event) => setAssignmentId(event.target.value)}
          disabled={loadingAssignments}
        >
          {assignments.map((assignment) => (
            <option key={assignment.id} value={assignment.id}>
              {assignment.titulo}
            </option>
          ))}
        </select>
      </label>

      {error && <p style={errorStyle}>{error}</p>}
      {success && <p style={successStyle}>{success}</p>}

      {loadingReviews ? (
        <p>Cargando revisiones...</p>
      ) : mapData.length === 0 ? (
        <p>No hay revisiones registradas para esta tarea.</p>
      ) : (
        <ul style={listStyle}>
          {mapData.map((review) => (
            <li key={review.id} style={metaCardStyle}>
              <div>
                <strong>Revisión #{review.id}</strong>
                <div style={metaInfoStyle}>
                  Nota enviada: {review.nota_numerica ?? 'sin nota'} · Guardada el{' '}
                  {review.fecha_envio || 'sin fecha'}
                </div>
              </div>
              <div>
                <label style={labelStyle}>
                  Nota de calidad
                  <input
                    style={inputStyle}
                    type="number"
                    step="0.5"
                    value={metaInputs[review.id]?.nota ?? ''}
                    onChange={(event) => handleMetaChange(review.id, 'nota', event.target.value)}
                  />
                </label>
                <label style={labelStyle}>
                  Observación
                  <textarea
                    style={{ ...inputStyle, minHeight: '70px' }}
                    value={metaInputs[review.id]?.observacion ?? ''}
                    onChange={(event) => handleMetaChange(review.id, 'observacion', event.target.value)}
                  />
                </label>
                <button type="button" style={buttonStyle} onClick={() => handleSubmitMeta(review.id)}>
                  Guardar meta-revisión
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const panelStyle = {
  border: '1px solid #dadada',
  borderRadius: '8px',
  padding: '1rem',
  background: '#fff'
};

const reviewsLayout = {
  display: 'flex',
  gap: '1rem',
  alignItems: 'flex-start'
};

const taskListStyle = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  width: '240px',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem'
};

const taskButtonStyle = (active) => ({
  width: '100%',
  padding: '0.6rem 0.75rem',
  borderRadius: '6px',
  border: active ? '2px solid #0b74de' : '1px solid #d0d0d0',
  background: active ? '#eaf2ff' : '#f8f8f8',
  cursor: 'pointer',
  textAlign: 'left'
});

const reviewFormStyle = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem'
};

const reviewRightColumn = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem'
};

const rubricFieldStyle = {
  display: 'flex',
  flexDirection: 'column'
};

const labelStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
  fontWeight: 600
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
  cursor: 'pointer',
  fontWeight: 600
};

const errorStyle = {
  color: 'crimson'
};

const successStyle = {
  color: '#1f7a1f'
};

const listStyle = {
  listStyle: 'none',
  padding: 0,
  margin: '1.5rem 0',
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem'
};

const metaCardStyle = {
  border: '1px solid #e0e0e0',
  borderRadius: '8px',
  padding: '1rem',
  background: '#fafafa',
  display: 'flex',
  gap: '1rem',
  justifyContent: 'space-between'
};

const metaInfoStyle = {
  fontSize: '0.85rem',
  color: '#666'
};

const viewerCard = {
  border: '1px solid #e0e0e0',
  borderRadius: '8px',
  padding: '0.75rem',
  background: '#fdfdfd',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem'
};

const viewerHeader = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center'
};

const viewerGrid = {
  display: 'grid',
  gridTemplateColumns: '280px 1fr',
  gap: '1rem'
};

const viewerSidebar = {
  border: '1px solid #e5e5e5',
  borderRadius: '6px',
  padding: '0.5rem',
  maxHeight: '520px',
  overflowY: 'auto',
  background: '#fff'
};

const viewerContent = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem'
};

const anchorBar = {
  display: 'flex',
  gap: '0.5rem',
  flexWrap: 'wrap',
  alignItems: 'center'
};

const anchorButton = {
  border: '1px solid #0b74de',
  background: 'transparent',
  color: '#0b74de',
  borderRadius: '999px',
  padding: '0.2rem 0.6rem',
  cursor: 'pointer',
  fontSize: '0.85rem'
};

const binaryWarning = {
  padding: '1rem',
  border: '1px dashed #d97706',
  borderRadius: '6px',
  background: '#fff7ed',
  color: '#92400e'
};

const linkButton = {
  border: '1px solid #0b74de',
  borderRadius: '4px',
  padding: '0.35rem 0.75rem',
  color: '#0b74de',
  background: '#fff',
  fontWeight: 600,
  cursor: 'pointer'
};
