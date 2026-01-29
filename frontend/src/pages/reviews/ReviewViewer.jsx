import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthContext.jsx';
import { API_BASE, getJson, postJson } from '../../api.js';
import FileTree from '../../components/FileTree.jsx';
import Breadcrumbs from '../../components/Breadcrumbs.jsx';
import EditorPane from '../../components/EditorPane.jsx';
import { ancestors, buildTreeFromPaths, collectDirPaths, normalizePath } from '../../utils/fileTreeHelpers.js';
import { readFromURL, writeToURL } from '../../utils/permalink.js';
import {
  viewerCard,
  viewerHeader,
  viewerGrid,
  viewerSidebar,
  viewerContent,
  anchorBar,
  anchorButton,
  binaryWarning,
  previewWrapper,
  previewFrame,
  linkButton,
  errorStyle,
  splitHandle,
  metaReviewPanel,
  miniMeta,
  statusList,
  statusItem,
  statusActions,
  statusBadgePending,
  statusBadgeSubmitted,
  statusBadgeGraded,
  linkPill,
  metaReviewFields,
  labelStyle,
  inputStyle,
  successStyle
} from './styles.js';
import { findBestPath } from './helpers.js';
import { buildAlias, formatRelativeTime } from '../../utils/reviewCommentFormat.js';

const PREVIEWABLE_IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']);

function getFileExtension(pathValue) {
  if (!pathValue) return '';
  const lastDot = pathValue.lastIndexOf('.');
  if (lastDot === -1) return '';
  return pathValue.slice(lastDot + 1).toLowerCase();
}

function getPreviewType(pathValue) {
  const ext = getFileExtension(pathValue);
  if (!ext) return '';
  if (ext === 'pdf') return 'pdf';
  if (PREVIEWABLE_IMAGE_EXTENSIONS.has(ext)) return 'image';
  return '';
}

/**
 * Visor de revisión que muestra árbol de archivos, comentarios en línea y descarga de la entrega.
 */
export default function ReviewViewer({
  revisionId,
  initialFileId = '',
  initialPath = '',
  initialLine: presetLine = 0,
  onFileOpened,
  readOnly = false
}) {
  const { token, role } = useAuth();
  const [files, setFiles] = useState([]);
  const [submissionMeta, setSubmissionMeta] = useState(null);
  const [expandedPaths, setExpandedPaths] = useState(new Set());
  const [currentPath, setCurrentPath] = useState('');
  const [currentFileId, setCurrentFileId] = useState('');
  const [initialLine, setInitialLine] = useState(0);
  const [fileData, setFileData] = useState({
    content: '',
    comments: [],
    isBinary: false,
    path: '',
    size: 0
  });
  const [binaryPreviewUrl, setBinaryPreviewUrl] = useState('');
  const [binaryPreviewType, setBinaryPreviewType] = useState('');
  const [binaryPreviewLoading, setBinaryPreviewLoading] = useState(false);
  const [binaryPreviewError, setBinaryPreviewError] = useState('');
  const [treeLoading, setTreeLoading] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [error, setError] = useState('');
  const pendingFileRef = useRef(null);
  const [downloading, setDownloading] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(180);
  const splitRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [reviewInfo, setReviewInfo] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [metaReview, setMetaReview] = useState({ nota: '', observacion: '' });
  const [metaReviewInfo, setMetaReviewInfo] = useState(null);
  const [metaReviewLoading, setMetaReviewLoading] = useState(false);
  const [metaReviewSaving, setMetaReviewSaving] = useState(false);
  const [metaReviewError, setMetaReviewError] = useState('');
  const [metaReviewSuccess, setMetaReviewSuccess] = useState('');

  useEffect(() => {
    if (!revisionId) {
      pendingFileRef.current = null;
      return;
    }

    const normalizedInitialId = String(initialFileId || '').trim();
    if (normalizedInitialId) {
      pendingFileRef.current = { fileId: normalizedInitialId, line: presetLine || 0 };
      return;
    }

    if (initialPath) {
      pendingFileRef.current = { path: normalizePath(initialPath), line: presetLine || 0 };
      return;
    }

    // Fallback: leer ?file&line o ?path&line de la URL si no vino por props
    const { fileId: urlFileId, path: urlPath, line: urlLine, revisionId: urlRevision } = readFromURL();
    const normalizedUrlFileId = String(urlFileId || '').trim();
    const safeLine = Number.isInteger(urlLine) && urlLine > 0 ? urlLine : 0;
    if (normalizedUrlFileId && (urlRevision === null || Number(urlRevision) === Number(revisionId))) {
      pendingFileRef.current = { fileId: normalizedUrlFileId, line: safeLine };
    } else if (urlPath && (urlRevision === null || Number(urlRevision) === Number(revisionId))) {
      pendingFileRef.current = { path: normalizePath(urlPath), line: safeLine };
    } else {
      pendingFileRef.current = null;
    }
  }, [revisionId, initialFileId, initialPath, presetLine]);

  useEffect(() => {
    if (!revisionId) {
      setFiles([]);
      setSubmissionMeta(null);
      setExpandedPaths(new Set());
      setCurrentPath('');
      setCurrentFileId('');
      setError('');
      setFileData({
        content: '',
        comments: [],
        isBinary: false,
        path: '',
        size: 0
      });
      setBinaryPreviewUrl('');
      setBinaryPreviewType('');
      setBinaryPreviewLoading(false);
      setBinaryPreviewError('');
      setReviewInfo(null);
      setReviewLoading(false);
      setMetaReview({ nota: '', observacion: '' });
      setMetaReviewInfo(null);
      setMetaReviewLoading(false);
      setMetaReviewSaving(false);
      setMetaReviewError('');
      setMetaReviewSuccess('');
      return;
    }

    const loadFiles = async () => {
      try {
        setTreeLoading(true);
        setError('');
        const data = await getJson(`/reviews/${revisionId}/files`);
        setFiles(data.files || []);
        setSubmissionMeta({
          zipName: data.zipName,
          submissionId: data.submissionId
        });
        const names = (data.files || []).map((file) => normalizePath(file.path));
        setExpandedPaths(new Set(collectDirPaths(names)));
        setCurrentPath('');
        setCurrentFileId('');
        setInitialLine(0);
      } catch (err) {
        setFiles([]);
        setSubmissionMeta(null);
        setError(err.message);
      } finally {
        setTreeLoading(false);
      }
    };

    loadFiles();
  }, [revisionId]);

  const fileNames = useMemo(() => files.map((file) => normalizePath(file.path)), [files]);
  const treeData = useMemo(() => buildTreeFromPaths(fileNames), [fileNames]);
  const fileMapById = useMemo(() => new Map(files.map((file) => [file.id, file])), [files]);
  const fileMapByPath = useMemo(
    () => new Map(files.map((file) => [normalizePath(file.path), file])),
    [files]
  );
  const canMetaReview = role === 'ADMIN' || role === 'PROF';

  useEffect(() => {
    if (!revisionId || !canMetaReview) {
      setReviewInfo(null);
      setReviewLoading(false);
      setMetaReview({ nota: '', observacion: '' });
      setMetaReviewInfo(null);
      setMetaReviewLoading(false);
      setMetaReviewSaving(false);
      setMetaReviewError('');
      setMetaReviewSuccess('');
      return;
    }
    setMetaReviewError('');
    setMetaReviewSuccess('');
  }, [revisionId, canMetaReview]);

  useEffect(() => {
    if (!revisionId || !canMetaReview) {
      return;
    }

    let active = true;
    const loadMetaReview = async () => {
      try {
        setMetaReviewLoading(true);
        setMetaReviewError('');
        const data = await getJson(`/reviews/${revisionId}/meta`);
        if (!active) return;
        const meta = data?.meta || null;
        setMetaReviewInfo(meta);
        setMetaReview({
          nota: meta?.nota_calidad ?? '',
          observacion: meta?.observacion ?? ''
        });
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
  }, [revisionId, canMetaReview]);

  useEffect(() => {
    if (!revisionId || !submissionMeta?.submissionId || !canMetaReview) {
      setReviewInfo(null);
      return;
    }

    let active = true;

    const loadReviewInfo = async () => {
      try {
        setReviewLoading(true);
        const list = await getJson(`/reviews?submissionId=${submissionMeta.submissionId}`);
        if (!active) return;
        const matched = Array.isArray(list)
          ? list.find((item) => Number(item.id) === Number(revisionId))
          : null;
        setReviewInfo(matched || null);
      } catch (err) {
        if (!active) return;
        setReviewInfo(null);
      } finally {
        if (active) {
          setReviewLoading(false);
        }
      }
    };

    loadReviewInfo();

    return () => {
      active = false;
    };
  }, [revisionId, submissionMeta?.submissionId, canMetaReview]);

  const commentsByLine = useMemo(() => {
    const map = new Map();
    (fileData.comments || []).forEach((comment) => {
      const lineNum = Number(comment.linea);
      if (!Number.isInteger(lineNum) || lineNum <= 0) return;
      const content = (comment.contenido ?? '').trim();
      if (!content) return;
      const list = map.get(lineNum) || [];
      const authorName = (comment.autor?.nombre ?? '').trim();
      const alias = buildAlias(authorName || 'Revisor');
      const { relativeText, absoluteText } = formatRelativeTime(comment.creado_en);
      list.push({
        id: comment.id,
        message: content,
        alias,
        aliasTitle: authorName || 'Revisor',
        timeText: relativeText,
        timeTitle: absoluteText
      });
      map.set(lineNum, list);
    });
    return map;
  }, [fileData.comments]);

  const commentAnchors = useMemo(
    () =>
      (fileData.comments || [])
        .map((comment) => {
          const lineNum = Number(comment.linea);
          if (!Number.isInteger(lineNum) || lineNum <= 0) return null;
          return {
            id: comment.id,
            line: lineNum,
            text: comment.contenido
          };
        })
        .filter(Boolean),
    [fileData.comments]
  );

  /**
   * Abre un archivo por su identificador y actualiza estado + URL.
   */
  const openFileById = useCallback(
    async (fileId, line = 0) => {
      if (!revisionId || !fileId) return;
      const parsedLine = Number(line);
      const safeLine = Number.isInteger(parsedLine) && parsedLine > 0 ? parsedLine : 0;
      try {
        setFileLoading(true);
        setError('');
        setBinaryPreviewUrl('');
        setBinaryPreviewType('');
        setBinaryPreviewLoading(false);
        setBinaryPreviewError('');
        const data = await getJson(`/reviews/${revisionId}/file?fileId=${encodeURIComponent(fileId)}`);
        if (!data?.path) {
          throw new Error('Archivo inválido');
        }
        const resolvedFileId = data.id || fileId;
        setFileData({
          content: data.content || '',
          comments: Array.isArray(data.comments) ? data.comments : [],
          isBinary: data.isBinary,
          path: data.path,
          size: data.size || 0
        });
        setCurrentPath(data.path);
        setCurrentFileId(resolvedFileId);
        setInitialLine(safeLine);
        setExpandedPaths((prev) => {
          const next = new Set(prev);
          ancestors(data.path).forEach((dir) => next.add(dir));
          return next;
        });
        writeToURL({
          revisionId,
          fileId: resolvedFileId,
          line: safeLine,
          useRevisionId: readOnly
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
    [revisionId, onFileOpened, readOnly]
  );

  /**
   * Abre un archivo a partir de su ruta (usada por el árbol de archivos).
   */
  const openFile = useCallback(
    (pathValue, line = 0) => {
      if (!pathValue) return;
      const normalizedPath = normalizePath(pathValue);
      const target = fileMapByPath.get(normalizedPath);
      if (!target?.id) {
        setError('No encontramos el archivo solicitado.');
        return;
      }
      openFileById(target.id, line);
    },
    [fileMapByPath, openFileById]
  );

  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();
    let objectUrl = '';

    if (!revisionId || !currentPath || !currentFileId || !fileData.isBinary) {
      setBinaryPreviewLoading(false);
      setBinaryPreviewError('');
      setBinaryPreviewType('');
      setBinaryPreviewUrl('');
      return () => {
        controller.abort();
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
        }
      };
    }

    const previewType = getPreviewType(currentPath);
    if (!previewType) {
      setBinaryPreviewLoading(false);
      setBinaryPreviewError('');
      setBinaryPreviewType('');
      setBinaryPreviewUrl('');
      return () => {
        controller.abort();
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
        }
      };
    }

    if (!token) {
      setBinaryPreviewLoading(false);
      setBinaryPreviewError('Tu sesión expiró, inicia sesión nuevamente.');
      setBinaryPreviewType(previewType);
      setBinaryPreviewUrl('');
      return () => {
        controller.abort();
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
        }
      };
    }

    setBinaryPreviewType(previewType);
    setBinaryPreviewLoading(true);
    setBinaryPreviewError('');
    setBinaryPreviewUrl('');

    const loadPreview = async () => {
      try {
        const response = await fetch(
          `${API_BASE}/reviews/${revisionId}/file/raw?fileId=${encodeURIComponent(currentFileId)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            },
            signal: controller.signal
          }
        );

        if (!response.ok) {
          let message = 'No pudimos cargar la vista previa.';
          try {
            const data = await response.json();
            if (data?.error) message = data.error;
          } catch (_err) {
            message = response.statusText || message;
          }
          throw new Error(message);
        }

        const blob = await response.blob();
        if (!isActive) return;
        objectUrl = URL.createObjectURL(blob);
        setBinaryPreviewUrl(objectUrl);
      } catch (err) {
        if (!isActive || controller.signal.aborted) return;
        setBinaryPreviewError(err.message || 'No pudimos cargar la vista previa.');
        setBinaryPreviewUrl('');
      } finally {
        if (isActive) {
          setBinaryPreviewLoading(false);
        }
      }
    };

    loadPreview();

    return () => {
      isActive = false;
      controller.abort();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [revisionId, currentPath, currentFileId, fileData.isBinary, token]);

  useEffect(() => {
    if (!revisionId || files.length === 0) {
      return;
    }

    const pending = pendingFileRef.current;
    if (pending) {
      const line = pending.line || 0;
      if (pending.fileId) {
        const target = fileMapById.get(pending.fileId);
        pendingFileRef.current = null;
        if (target?.id) {
          openFileById(target.id, line);
        } else if (files[0]?.id) {
          setError('No encontramos el archivo indicado. Abrimos el primero disponible.');
          openFileById(files[0].id, 0);
        }
        return;
      }

      const normalized = normalizePath(pending.path || '');
      const availablePath = findBestPath(fileNames, normalized);
      if (availablePath && availablePath !== normalized) {
        setError('No encontramos el archivo indicado. Abrimos el primero disponible.');
      }
      const target = fileMapByPath.get(availablePath);
      pendingFileRef.current = null;
      if (target?.id) {
        openFileById(target.id, availablePath === normalized ? line : 0);
      }
      return;
    }

    if (!currentFileId && fileNames.length > 0) {
      const best = findBestPath(fileNames, fileNames[0]);
      const target = fileMapByPath.get(best);
      if (target?.id) {
        openFileById(target.id, 0);
      }
    }
  }, [revisionId, files, fileNames, currentFileId, fileMapById, fileMapByPath, openFileById]);

  /**
   * Alterna la expansión de un directorio en el árbol de archivos.
   */
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

  /**
   * Ajusta la expansión del árbol según la ruta seleccionada en el breadcrumb.
   */
  const handleBreadcrumb = (segPath) => {
    if (!segPath) {
      setExpandedPaths(new Set(collectDirPaths(fileNames)));
      if (revisionId) {
        writeToURL({ revisionId, useRevisionId: readOnly });
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

  /**
   * Envía un comentario nuevo y recarga el archivo para reflejarlo.
   */
  const handleAddComment = async (line, text) => {
    if (readOnly) {
      return;
    }
    if (!revisionId || !currentFileId) {
      setError('Selecciona un archivo antes de comentar.');
      return;
    }
    const safeLine = Number(line) || 0;
    if (!safeLine) {
      setError('La línea indicada no es válida.');
      return;
    }
    const lastFileId = currentFileId;
    try {
      await postJson(`/reviews/${revisionId}/comments`, {
        fileId: currentFileId,
        linea: safeLine,
        contenido: text
      });
      await openFileById(lastFileId, safeLine);
    } catch (err) {
      setError(err.message);
    }
  };

  /**
   * Descarga el ZIP original de la entrega con autenticación del usuario.
   */
  const handleDownloadZip = async () => {
    if (!submissionMeta?.submissionId) return;
    if (!token) {
      setError('Tu sesión expiró, inicia sesión nuevamente.');
      return;
    }
    try {
      setDownloading(true);
      setError('');
      const response = await fetch(`${API_BASE}/submissions/${submissionMeta.submissionId}/download`, {
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
      link.download = submissionMeta.zipName || `entrega-${submissionMeta.submissionId}.zip`;
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

  const reviewStatus = useMemo(() => {
    if (!reviewInfo?.fecha_envio) {
      return { label: 'Pendiente', style: statusBadgePending };
    }
    if (reviewInfo.nota_numerica !== null && reviewInfo.nota_numerica !== undefined) {
      return { label: 'Con nota', style: statusBadgeGraded };
    }
    return { label: 'Enviada', style: statusBadgeSubmitted };
  }, [reviewInfo]);

  const submittedTime = useMemo(
    () => formatRelativeTime(reviewInfo?.fecha_envio),
    [reviewInfo?.fecha_envio]
  );

  const metaSavedTime = useMemo(
    () => formatRelativeTime(metaReviewInfo?.fecha_registro),
    [metaReviewInfo?.fecha_registro]
  );

  const handleSaveMetaReview = async () => {
    if (!revisionId) return;
    const notaValue = metaReview.nota !== '' ? Number(metaReview.nota) : null;
    if (metaReview.nota !== '' && !Number.isFinite(notaValue)) {
      setMetaReviewError('La nota de calidad no es válida.');
      return;
    }
    const notaValid = notaValue !== null && Number.isFinite(notaValue);
    const observacionValue = metaReview.observacion ? metaReview.observacion.trim() : '';

    if (!notaValid && !observacionValue) {
      setMetaReviewError('Ingresa al menos una nota u observación para la meta-revisión.');
      return;
    }

    try {
      setMetaReviewSaving(true);
      setMetaReviewError('');
      setMetaReviewSuccess('');
      await postJson(`/reviews/${revisionId}/meta`, {
        nota_calidad: notaValid ? notaValue : null,
        observacion: observacionValue
      });
      const data = await getJson(`/reviews/${revisionId}/meta`);
      setMetaReviewInfo(data?.meta || null);
      setMetaReviewSuccess('Meta-revisión guardada.');
    } catch (err) {
      setMetaReviewError(err.message);
    } finally {
      setMetaReviewSaving(false);
    }
  };

  // Control del separador vertical
  useEffect(() => {
    if (!dragging) return;
    const MIN_LEFT = 240;
    const MIN_RIGHT = 420;

    const handleMove = (event) => {
      if (!splitRef.current) return;
      const rect = splitRef.current.getBoundingClientRect();
      const totalWidth = rect.width;
      const raw = event.clientX - rect.left;
      const maxLeft = Math.max(MIN_LEFT, totalWidth - MIN_RIGHT);
      const clamped = Math.min(Math.max(raw, MIN_LEFT), maxLeft);
      setSidebarWidth(clamped);
    };

    const stop = () => setDragging(false);

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', stop);
    window.addEventListener('mouseleave', stop);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', stop);
      window.removeEventListener('mouseleave', stop);
    };
  }, [dragging]);

  const showBinaryPreview = fileData.isBinary && !!binaryPreviewUrl && !binaryPreviewLoading && !binaryPreviewError;
  const showBinaryLoading = fileData.isBinary && binaryPreviewLoading;
  const showBinaryError = fileData.isBinary && !!binaryPreviewError;
  const previewLabel = binaryPreviewType === 'pdf' ? 'PDF' : 'imagen';
  const showMetaReview = canMetaReview && !readOnly;

  return (
    <>
      <div style={viewerCard}>
        <div style={viewerHeader}>
          <strong>Archivos de la entrega</strong>
          {submissionMeta?.submissionId && (
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
          <div ref={splitRef} style={viewerGrid}>
            <aside
              style={{
                ...viewerSidebar,
                width: `${sidebarWidth}px`,
                minWidth: '240px',
                maxWidth: '780px',
                flex: '0 0 auto'
              }}
            >
              <FileTree
                nodes={treeData}
                selectedPath={currentPath}
                expandedPaths={expandedPaths}
                onToggleDir={toggleDir}
                onOpenFile={(filePath) => openFile(filePath, 0)}
              />
            </aside>
            <div
              role="separator"
              aria-orientation="vertical"
              tabIndex={-1}
              style={splitHandle}
              onMouseDown={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
            />
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
                        const parsed = Number(comment.line);
                        const targetLine = Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
                        openFileById(currentFileId, targetLine);
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
                showBinaryPreview ? (
                  <div style={previewWrapper}>
                    <iframe
                      title={`Vista previa de ${previewLabel}`}
                      src={binaryPreviewUrl}
                      style={previewFrame}
                    />
                  </div>
                ) : showBinaryLoading ? (
                  <p>Cargando vista previa...</p>
                ) : showBinaryError ? (
                  <div style={binaryWarning}>{binaryPreviewError}</div>
                ) : (
                  <div style={binaryWarning}>Este archivo es binario. Descárgalo para revisarlo por fuera.</div>
                )
              ) : (
                <EditorPane
                  path={currentPath}
                  code={fileData.content}
                  height="560px"
                  initialLine={initialLine}
                  commentsByLine={commentsByLine}
                  onAddComment={handleAddComment}
                  revisionId={revisionId}
                  fileId={currentFileId}
                  readOnly={readOnly}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {showMetaReview && (
        <section style={metaReviewPanel}>
          <div style={viewerHeader}>
            <strong>Meta-revisión</strong>
            {metaReviewLoading && <span style={miniMeta}>Cargando...</span>}
          </div>
          {metaReviewError && <p style={errorStyle}>{metaReviewError}</p>}
          {metaReviewSuccess && <p style={successStyle}>{metaReviewSuccess}</p>}
          {reviewLoading ? (
            <p style={miniMeta}>Cargando resumen de la revisión...</p>
          ) : (
            <ul style={statusList}>
              <li style={statusItem}>
                <div style={{ minWidth: '240px', flex: 1 }}>
                  <strong>Revisión #{revisionId}</strong>
                  <div style={miniMeta}>
                    Revisor: {reviewInfo?.equipo_revisor?.nombre || '—'}
                    {submissionMeta?.zipName ? ` · Entrega: ${submissionMeta.zipName}` : ''}
                  </div>
                  <div style={miniMeta} title={submittedTime.absoluteText || undefined}>
                    Enviada: {submittedTime.relativeText || reviewInfo?.fecha_envio || 'sin fecha'}
                    {reviewInfo?.nota_numerica !== null && reviewInfo?.nota_numerica !== undefined
                      ? ` · Nota: ${reviewInfo.nota_numerica}`
                      : ''}
                  </div>
                  {reviewInfo?.comentario && <div style={miniMeta}>Comentario: {reviewInfo.comentario}</div>}

                  <div style={metaReviewFields}>
                    <label style={labelStyle}>
                      Nota de calidad
                      <input
                        style={inputStyle}
                        type="number"
                        step="0.5"
                        value={metaReview.nota}
                        onChange={(event) =>
                          setMetaReview((prev) => ({ ...prev, nota: event.target.value }))
                        }
                        disabled={metaReviewSaving || metaReviewLoading}
                      />
                    </label>
                    <label style={labelStyle}>
                      Observación
                      <textarea
                        style={{ ...inputStyle, minHeight: '80px' }}
                        value={metaReview.observacion}
                        onChange={(event) =>
                          setMetaReview((prev) => ({ ...prev, observacion: event.target.value }))
                        }
                        disabled={metaReviewSaving || metaReviewLoading}
                      />
                    </label>
                  </div>

                  {metaReviewInfo?.fecha_registro && (
                    <div style={miniMeta} title={metaSavedTime.absoluteText || undefined}>
                      Meta registrada {metaSavedTime.relativeText || metaReviewInfo.fecha_registro}
                    </div>
                  )}
                </div>
                <div style={statusActions}>
                  <span style={reviewStatus.style}>{reviewStatus.label}</span>
                  <button
                    type="button"
                    style={{
                      ...linkPill,
                      opacity: metaReviewSaving ? 0.6 : 1,
                      cursor: metaReviewSaving ? 'wait' : 'pointer'
                    }}
                    onClick={handleSaveMetaReview}
                    disabled={metaReviewSaving}
                  >
                    {metaReviewSaving ? 'Guardando...' : 'Guardar meta-revisión'}
                  </button>
                </div>
              </li>
            </ul>
          )}
        </section>
      )}
    </>
  );
}
