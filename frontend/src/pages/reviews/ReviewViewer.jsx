import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthContext.jsx';
import { API_BASE, getJson, postJson } from '../../api.js';
import { ancestors, buildTreeFromPaths, collectDirPaths, normalizePath } from '../../utils/fileTreeHelpers.js';
import { readFromURL, writeToURL } from '../../utils/permalink.js';
import { findBestPath } from './reviewFilePathResolver.js';
import ReviewMainCard from './ReviewMainCard.jsx';
import ReviewMetaPanels from './ReviewMetaPanels.jsx';
import useReviewMetaState from './useReviewMetaState.js';
import useResizableSidebar from './useResizableSidebar.js';
import {
  buildCommentsByLine,
  buildFileCommentItems,
  getFirstCommentLine,
  getPreviewType,
  normalizeCountMap,
  normalizeFirstLineMap
} from './reviewViewerUtils.js';

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
  const [codeCommentCounts, setCodeCommentCounts] = useState({});
  const [codeCommentFirstLine, setCodeCommentFirstLine] = useState({});
  const [fileCommentCounts, setFileCommentCounts] = useState({});
  const [fileComments, setFileComments] = useState([]);
  const [fileCommentsLoading, setFileCommentsLoading] = useState(false);
  const [fileCommentsError, setFileCommentsError] = useState('');
  const [fileCommentDraft, setFileCommentDraft] = useState('');
  const [fileCommentFormOpen, setFileCommentFormOpen] = useState(false);
  const [fileCommentSaving, setFileCommentSaving] = useState(false);
  const fileCommentsRef = useRef(null);
  const pendingFileCommentScrollRef = useRef(false);
  const [binaryPreviewUrl, setBinaryPreviewUrl] = useState('');
  const [binaryPreviewType, setBinaryPreviewType] = useState('');
  const [binaryPreviewLoading, setBinaryPreviewLoading] = useState(false);
  const [binaryPreviewError, setBinaryPreviewError] = useState('');
  const [binaryPreviewTick, setBinaryPreviewTick] = useState(0);
  const [treeLoading, setTreeLoading] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [error, setError] = useState('');
  const pendingFileRef = useRef(null);
  const [downloading, setDownloading] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(180);
  const splitRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [commentListMode, setCommentListMode] = useState('');
  const canCreateComments = !readOnly && role === 'ALUM';

  const resetFileCommentState = () => {
    setFileCommentCounts({});
    setFileComments([]);
    setFileCommentsLoading(false);
    setFileCommentsError('');
    setFileCommentDraft('');
    setFileCommentFormOpen(false);
    setFileCommentSaving(false);
  };

  const resetPreviewState = () => {
    setBinaryPreviewUrl('');
    setBinaryPreviewType('');
    setBinaryPreviewLoading(false);
    setBinaryPreviewError('');
  };

  const { startDragging } = useResizableSidebar({
    dragging,
    splitRef,
    setDragging,
    setSidebarWidth
  });

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
    const { fileId: urlFileId, path: urlPath, line: urlLine, revisionId: urlRevision, section } = readFromURL();
    const normalizedUrlFileId = String(urlFileId || '').trim();
    const normalizedSection = section === 'comments' ? 'comments' : '';
    const safeLine = normalizedSection ? 0 : (Number.isInteger(urlLine) && urlLine > 0 ? urlLine : 0);
    if (normalizedUrlFileId && (urlRevision === null || Number(urlRevision) === Number(revisionId))) {
      pendingFileRef.current = { fileId: normalizedUrlFileId, line: safeLine, section: normalizedSection };
    } else if (urlPath && (urlRevision === null || Number(urlRevision) === Number(revisionId))) {
      pendingFileRef.current = { path: normalizePath(urlPath), line: safeLine, section: normalizedSection };
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
      setCodeCommentCounts({});
      setCodeCommentFirstLine({});
      resetFileCommentState();
      resetPreviewState();
      resetMetaReviewState();
      setCommentListMode('');
      return;
    }

    const loadFiles = async () => {
      try {
        setTreeLoading(true);
        setError('');
        const data = await getJson(`/reviews/${revisionId}/files`);
        setFiles(data.files || []);
        setFileCommentCounts(normalizeCountMap(data?.fileCommentCounts || {}));
        setCodeCommentCounts(normalizeCountMap(data?.codeCommentCounts || {}));
        setCodeCommentFirstLine(normalizeFirstLineMap(data?.codeCommentFirstLine || {}));
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
        setFileCommentCounts({});
        setCodeCommentCounts({});
        setCodeCommentFirstLine({});
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
  const showStudentReviewSummary = readOnly && role === 'ALUM';
  const {
    reviewInfo,
    reviewLoading,
    metaReview,
    metaReviewInfo,
    metaReviewLoading,
    metaReviewSaving,
    metaReviewError,
    metaReviewSuccess,
    reviewStatus,
    submittedTime,
    metaSavedTime,
    setMetaReview,
    setMetaReviewInfo,
    setMetaReviewSaving,
    setMetaReviewError,
    setMetaReviewSuccess,
    resetMetaReviewState
  } = useReviewMetaState({
    revisionId,
    canMetaReview,
    submissionId: submissionMeta?.submissionId
  });

  const commentsByLine = useMemo(
    () => buildCommentsByLine(fileData.comments || []),
    [fileData.comments]
  );

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

  const fileCommentItems = useMemo(
    () => buildFileCommentItems(fileComments || []),
    [fileComments]
  );
  const hasFileComment = fileCommentItems.length > 0;

  const requestedPreviewType = getPreviewType(currentPath);
  const shouldRenderPreview = !!requestedPreviewType && (fileData.isBinary || requestedPreviewType === 'html');
  const showFileCommentSection = shouldRenderPreview;
  const codeCommentPaths = useMemo(
    () => fileNames.filter((pathValue) => (Number(codeCommentCounts[pathValue]) || 0) > 0),
    [fileNames, codeCommentCounts]
  );
  const fileCommentPaths = useMemo(
    () => fileNames.filter((pathValue) => (Number(fileCommentCounts[pathValue]) || 0) > 0),
    [fileNames, fileCommentCounts]
  );
  const codeCommentFileCount = codeCommentPaths.length;
  const fileCommentFileCount = fileCommentPaths.length;
  const showCommentSummary = codeCommentFileCount > 0 || fileCommentFileCount > 0;
  const isCodeListActive = commentListMode === 'code';
  const isFileListActive = commentListMode === 'file';
  const activeCommentPaths = isCodeListActive ? codeCommentPaths : fileCommentPaths;
  const activeCommentLabel = isCodeListActive
    ? 'Archivos con comentarios de código'
    : 'Archivos con comentarios generales';

  /**
   * Abre un archivo por su identificador y actualiza estado + URL.
   */
  const openFileById = useCallback(
    async (fileId, line = 0, options = {}) => {
      if (!revisionId || !fileId) return;
      const normalizedSection = options?.section === 'comments' ? 'comments' : '';
      const parsedLine = Number(line);
      const safeLine =
        normalizedSection === 'comments'
          ? 0
          : (Number.isInteger(parsedLine) && parsedLine > 0 ? parsedLine : 0);
      if (normalizedSection === 'comments') {
        pendingFileCommentScrollRef.current = true;
      }
      try {
        setFileLoading(true);
        setError('');
        setBinaryPreviewUrl('');
        setBinaryPreviewType('');
        setBinaryPreviewLoading(false);
        setBinaryPreviewError('');
        setBinaryPreviewTick((prev) => prev + 1); // Forzar recarga de vista previa
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
        const normalizedPath = normalizePath(data.path);
        const commentTotal = Array.isArray(data.comments) ? data.comments.length : 0;
        setCodeCommentCounts((prev) => {
          const next = { ...prev };
          if (normalizedPath) {
            if (commentTotal > 0) {
              next[normalizedPath] = commentTotal;
            } else {
              delete next[normalizedPath];
            }
          }
          return next;
        });
        const firstLine = getFirstCommentLine(data.comments || []);
        setCodeCommentFirstLine((prev) => {
          const next = { ...prev };
          if (normalizedPath) {
            if (firstLine > 0) {
              next[normalizedPath] = firstLine;
            } else {
              delete next[normalizedPath];
            }
          }
          return next;
        });
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
          section: normalizedSection,
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
    (pathValue, line = 0, options = {}) => {
      if (!pathValue) return;
      const normalizedPath = normalizePath(pathValue);
      const target = fileMapByPath.get(normalizedPath);
      if (!target?.id) {
        setError('No encontramos el archivo solicitado.');
        return;
      }
      openFileById(target.id, line, options);
    },
    [fileMapByPath, openFileById]
  );

  /**
   * Recarga los comentarios generales de un archivo y sincroniza sus conteos por ruta.
   */
  const refreshFileComments = useCallback(
    async (fileId, pathValue) => {
      if (!revisionId || !fileId) return [];
      const data = await getJson(`/reviews/${revisionId}/file-comments?fileId=${encodeURIComponent(fileId)}`);
      const list = Array.isArray(data) ? data : data?.comments || [];
      setFileComments(list);
      const normalizedPath = normalizePath(pathValue || '');
      if (normalizedPath) {
        setFileCommentCounts((prev) => {
          const next = { ...prev };
          const count = Array.isArray(list) ? list.length : 0;
          if (count > 0) {
            next[normalizedPath] = count;
          } else {
            delete next[normalizedPath];
          }
          return next;
        });
      }
      return list;
    },
    [revisionId]
  );

  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();
    let objectUrl = '';

    if (!revisionId || !currentPath || !currentFileId || !shouldRenderPreview) {
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

    const previewType = requestedPreviewType;
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
  }, [revisionId, currentPath, currentFileId, shouldRenderPreview, requestedPreviewType, token, binaryPreviewTick]);

  useEffect(() => {
    if (!revisionId || !currentFileId || !showFileCommentSection) {
      setFileComments([]);
      setFileCommentsLoading(false);
      setFileCommentsError('');
      return;
    }

    let active = true;
    setFileCommentsLoading(true);
    setFileCommentsError('');

    refreshFileComments(currentFileId, currentPath)
      .catch((err) => {
        if (!active) return;
        setFileCommentsError(err.message || 'No pudimos cargar los comentarios.');
        setFileComments([]);
      })
      .finally(() => {
        if (active) {
          setFileCommentsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [revisionId, currentFileId, currentPath, showFileCommentSection, refreshFileComments]);

  useEffect(() => {
    setFileCommentDraft('');
    setFileCommentFormOpen(false);
    setFileCommentsError('');
    setFileCommentSaving(false);
  }, [currentFileId]);

  const scrollToFileComments = useCallback((behavior = 'smooth') => {
    if (!fileCommentsRef.current) return;
    fileCommentsRef.current.scrollIntoView({ behavior, block: 'start' });
  }, []);

  useEffect(() => {
    if (!pendingFileCommentScrollRef.current) return;
    if (!showFileCommentSection) return;
    if (!fileCommentsRef.current) return;
    const raf = requestAnimationFrame(() => {
      scrollToFileComments('smooth');
      pendingFileCommentScrollRef.current = false;
    });
    return () => cancelAnimationFrame(raf);
  }, [showFileCommentSection, fileCommentsLoading, fileComments, scrollToFileComments]);

  useEffect(() => {
    if (!revisionId || files.length === 0) {
      return;
    }

    const pending = pendingFileRef.current;
    if (pending) {
      const line = pending.line || 0;
      const section = pending.section || '';
      if (pending.fileId) {
        const target = fileMapById.get(pending.fileId);
        pendingFileRef.current = null;
        if (target?.id) {
          openFileById(target.id, line, { section });
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
        openFileById(target.id, availablePath === normalized ? line : 0, { section });
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
    if (!canCreateComments) {
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
   * Crea o actualiza el comentario general del fichero actualmente seleccionado.
   */
  const handleAddFileComment = async () => {
    if (!canCreateComments) return;
    if (!revisionId || !currentFileId) {
      setFileCommentsError('Selecciona un archivo antes de comentar.');
      return;
    }
    const contenido = fileCommentDraft.trim();
    if (!contenido) {
      setFileCommentsError('El comentario no puede estar vacío.');
      return;
    }
    const lastFileId = currentFileId;
    const lastPath = currentPath;
    try {
      setFileCommentSaving(true);
      setFileCommentsError('');
      await postJson(`/reviews/${revisionId}/file-comments`, {
        fileId: currentFileId,
        contenido
      });
      await refreshFileComments(lastFileId, lastPath);
      setFileCommentDraft('');
      setFileCommentFormOpen(false);
    } catch (err) {
      setFileCommentsError(err.message);
    } finally {
      setFileCommentSaving(false);
    }
  };

  /**
   * Abre el archivo actual en una pestaña nueva (raw binario o texto plano).
   */
  const handleOpenInNewTab = async () => {
    if (!revisionId || !currentFileId) {
      setError('Selecciona un archivo antes de abrirlo.');
      return;
    }
    try {
      if (shouldRenderPreview) {
        if (!token) {
          setError('Tu sesión expiró, inicia sesión nuevamente.');
          return;
        }
        const response = await fetch(
          `${API_BASE}/reviews/${revisionId}/file/raw?fileId=${encodeURIComponent(currentFileId)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );
        if (!response.ok) {
          let message = 'No pudimos abrir el archivo.';
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
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
      }

      const blob = new Blob([fileData.content || ''], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err.message || 'No pudimos abrir el archivo.');
    }
  };

  const handleOpenFileCommentForm = () => {
    if (!canCreateComments) return;
    setFileCommentFormOpen(true);
    if (!fileCommentDraft && fileComments.length === 1) {
      const existing = (fileComments[0]?.contenido || '').trim();
      if (existing) {
        setFileCommentDraft(existing);
      }
    }
  };

  /**
   * Navega al archivo y posiciona/abre la sección de comentarios generales.
   */
  const handleOpenFileComments = useCallback(
    (pathValue) => {
      if (!pathValue) return;
      const normalized = normalizePath(pathValue);
      if (normalized === currentPath && showFileCommentSection) {
        writeToURL({
          revisionId,
          fileId: currentFileId,
          section: 'comments',
          useRevisionId: readOnly
        });
        scrollToFileComments('smooth');
        return;
      }
      pendingFileCommentScrollRef.current = true;
      openFile(normalized, 0, { section: 'comments' });
    },
    [currentPath, showFileCommentSection, openFile, currentFileId, revisionId, readOnly, scrollToFileComments]
  );

  /**
   * Abre un archivo con comentarios de código posicionándose en su primera línea comentada.
   */
  const handleOpenCodeCommentFile = useCallback(
    (pathValue) => {
      if (!pathValue) return;
      const normalized = normalizePath(pathValue);
      const line = Number(codeCommentFirstLine[normalized]) || 0;
      setCommentListMode('');
      openFile(normalized, line);
    },
    [codeCommentFirstLine, openFile]
  );

  const handleOpenFileCommentFromList = useCallback(
    (pathValue) => {
      setCommentListMode('');
      handleOpenFileComments(pathValue);
    },
    [handleOpenFileComments]
  );

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

  /**
   * Valida y guarda la meta-revisión (nota y/u observación) de la revisión actual.
   */
  const handleSaveMetaReview = async () => {
    if (!revisionId) return;
    const notaValue = metaReview.nota !== '' ? Number(metaReview.nota) : null;
    if (metaReview.nota !== '' && !Number.isFinite(notaValue)) {
      setMetaReviewError('La nota final no es válida.');
      return;
    }
    const notaValid = notaValue !== null && Number.isFinite(notaValue);
    if (notaValid && (notaValue < 0 || notaValue > 10)) {
      setMetaReviewError('La nota final debe estar entre 0 y 10.');
      return;
    }
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
        nota_final: notaValid ? notaValue : null,
        observacion: observacionValue
      });
      const data = await getJson(`/reviews/${revisionId}/meta`);
      setMetaReviewInfo(data?.meta || null);
      setMetaReviewSuccess('Meta-revisión guardada.');
      window.alert('Meta-revisión guardada.');
    } catch (err) {
      setMetaReviewError(err.message);
    } finally {
      setMetaReviewSaving(false);
    }
  };

  const showBinaryPreview = shouldRenderPreview && !!binaryPreviewUrl && !binaryPreviewLoading && !binaryPreviewError;
  const showBinaryLoading = shouldRenderPreview && binaryPreviewLoading;
  const showBinaryError = shouldRenderPreview && !!binaryPreviewError;
  const previewLabel = binaryPreviewType === 'pdf' ? 'PDF' : binaryPreviewType === 'html' ? 'HTML' : 'imagen';
  const showMetaReview = canMetaReview && !readOnly;
  const editorReadOnly = readOnly || role !== 'ALUM';

  const toggleCodeCommentList = () => setCommentListMode((prev) => (prev === 'code' ? '' : 'code'));
  const toggleFileCommentList = () => setCommentListMode((prev) => (prev === 'file' ? '' : 'file'));

  const fileCommentSectionProps = {
    fileCommentsRef,
    fileCommentsLoading,
    fileCommentItems,
    fileCommentsError,
    fileCommentFormOpen,
    canCreateComments,
    fileCommentSaving,
    fileCommentDraft,
    onFileCommentDraftChange: setFileCommentDraft,
    onOpenFileCommentForm: handleOpenFileCommentForm,
    onAddFileComment: handleAddFileComment,
    hasFileComment
  };

  const handleOpenCommentAnchor = (line) => {
    const parsed = Number(line);
    const targetLine = Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
    openFileById(currentFileId, targetLine);
  };

  const workspaceProps = {
    splitRef,
    sidebarWidth,
    onStartDrag: startDragging,
    treeData,
    currentPath,
    expandedPaths,
    onToggleDir: toggleDir,
    onOpenFile: openFile,
    fileCommentCounts,
    onCommentBadgeClick: handleOpenFileComments,
    codeCommentCounts,
    onCodeCommentBadgeClick: handleOpenCodeCommentFile,
    onBreadcrumbNavigate: handleBreadcrumb,
    onOpenInNewTab: handleOpenInNewTab,
    commentAnchors,
    onOpenCommentAnchor: handleOpenCommentAnchor,
    fileLoading,
    shouldRenderPreview,
    showBinaryPreview,
    showBinaryLoading,
    showBinaryError,
    binaryPreviewUrl,
    previewLabel,
    binaryPreviewType,
    binaryPreviewError,
    showFileCommentSection,
    fileCommentSectionProps,
    fileContent: fileData.content,
    currentFileId,
    initialLine,
    commentsByLine,
    onAddComment: handleAddComment,
    revisionId,
    editorReadOnly
  };

  return (
    <>
      <ReviewMainCard
        submissionId={submissionMeta?.submissionId}
        downloading={downloading}
        onDownloadZip={handleDownloadZip}
        showCommentSummary={showCommentSummary}
        codeCommentFileCount={codeCommentFileCount}
        fileCommentFileCount={fileCommentFileCount}
        isCodeListActive={isCodeListActive}
        isFileListActive={isFileListActive}
        onToggleCodeList={toggleCodeCommentList}
        onToggleFileList={toggleFileCommentList}
        commentListMode={commentListMode}
        activeCommentPaths={activeCommentPaths}
        activeCommentLabel={activeCommentLabel}
        codeCommentCounts={codeCommentCounts}
        fileCommentCounts={fileCommentCounts}
        onOpenCodeCommentFile={handleOpenCodeCommentFile}
        onOpenFileCommentFromList={handleOpenFileCommentFromList}
        error={error}
        treeLoading={treeLoading}
        hasFiles={files.length > 0}
        workspaceProps={workspaceProps}
      />

      <ReviewMetaPanels
        showMetaReview={showMetaReview}
        showStudentReviewSummary={showStudentReviewSummary}
        metaReviewLoading={metaReviewLoading}
        metaReviewError={metaReviewError}
        metaReviewSuccess={metaReviewSuccess}
        reviewLoading={reviewLoading}
        revisionId={revisionId}
        reviewInfo={reviewInfo}
        submissionMeta={submissionMeta}
        submittedTime={submittedTime}
        metaReview={metaReview}
        onMetaReviewNotaChange={(value) => setMetaReview((prev) => ({ ...prev, nota: value }))}
        onMetaReviewObservacionChange={(value) =>
          setMetaReview((prev) => ({ ...prev, observacion: value }))
        }
        metaReviewSaving={metaReviewSaving}
        onSaveMetaReview={handleSaveMetaReview}
        metaReviewInfo={metaReviewInfo}
        metaSavedTime={metaSavedTime}
        reviewStatus={reviewStatus}
      />
    </>
  );
}
