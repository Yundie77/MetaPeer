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
  viewerHeaderLeft,
  viewerGrid,
  viewerSidebar,
  viewerContent,
  anchorBar,
  anchorButton,
  binaryWarning,
  previewWrapper,
  previewFrame,
  linkButton,
  commentSummaryRow,
  commentSummaryPill,
  commentSummaryPillActive,
  commentSummaryPanel,
  commentSummaryList,
  commentSummaryHint,
  fileCommentPanel,
  fileCommentHeader,
  fileCommentActions,
  fileCommentForm,
  fileCommentInput,
  fileCommentList,
  fileCommentItem,
  fileCommentMeta,
  fileCommentMessage,
  fileCommentEmpty,
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
  const [commentListMode, setCommentListMode] = useState('');

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
      setFileCommentCounts({});
      setFileComments([]);
      setFileCommentsLoading(false);
      setFileCommentsError('');
      setFileCommentDraft('');
      setFileCommentFormOpen(false);
      setFileCommentSaving(false);
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
      setCommentListMode('');
      return;
    }

    const loadFiles = async () => {
      try {
        setTreeLoading(true);
        setError('');
        const data = await getJson(`/reviews/${revisionId}/files`);
        setFiles(data.files || []);
        const rawCounts = data?.fileCommentCounts || {};
        const normalizedCounts = {};
        Object.entries(rawCounts).forEach(([pathValue, total]) => {
          const normalized = normalizePath(pathValue);
          const count = Number(total) || 0;
          if (normalized && count > 0) {
            normalizedCounts[normalized] = count;
          }
        });
        setFileCommentCounts(normalizedCounts);
        const rawCodeCounts = data?.codeCommentCounts || {};
        const normalizedCodeCounts = {};
        Object.entries(rawCodeCounts).forEach(([pathValue, total]) => {
          const normalized = normalizePath(pathValue);
          const count = Number(total) || 0;
          if (normalized && count > 0) {
            normalizedCodeCounts[normalized] = count;
          }
        });
        setCodeCommentCounts(normalizedCodeCounts);
        const rawFirstLines = data?.codeCommentFirstLine || {};
        const normalizedFirstLines = {};
        Object.entries(rawFirstLines).forEach(([pathValue, lineValue]) => {
          const normalized = normalizePath(pathValue);
          const line = Number(lineValue) || 0;
          if (normalized && line > 0) {
            normalizedFirstLines[normalized] = line;
          }
        });
        setCodeCommentFirstLine(normalizedFirstLines);
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

  const fileCommentItems = useMemo(
    () =>
      (fileComments || [])
        .map((comment) => {
          const content = (comment.contenido ?? '').trim();
          if (!content) return null;
          const authorName = (comment.autor?.nombre ?? '').trim();
          const alias = buildAlias(authorName || 'Revisor');
          const { relativeText, absoluteText } = formatRelativeTime(comment.creado_en);
          return {
            id: comment.id,
            message: content,
            alias,
            aliasTitle: authorName || 'Revisor',
            timeText: relativeText,
            timeTitle: absoluteText
          };
        })
        .filter(Boolean),
    [fileComments]
  );

  const showFileCommentSection = fileData.isBinary && !!binaryPreviewType;
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
        const firstLine = Array.isArray(data.comments)
          ? data.comments.reduce((min, comment) => {
              const line = Number(comment?.linea) || 0;
              if (line > 0 && line < min) return line;
              return min;
            }, Number.POSITIVE_INFINITY)
          : Number.POSITIVE_INFINITY;
        setCodeCommentFirstLine((prev) => {
          const next = { ...prev };
          if (normalizedPath) {
            if (Number.isFinite(firstLine) && firstLine > 0) {
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

  const handleAddFileComment = async () => {
    if (readOnly) return;
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

  const handleOpenInNewTab = async () => {
    if (!revisionId || !currentFileId) {
      setError('Selecciona un archivo antes de abrirlo.');
      return;
    }
    try {
      if (fileData.isBinary) {
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
    if (readOnly) return;
    setFileCommentFormOpen(true);
    if (!fileCommentDraft && fileComments.length === 1) {
      const existing = (fileComments[0]?.contenido || '').trim();
      if (existing) {
        setFileCommentDraft(existing);
      }
    }
  };

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
    if (notaValid && (notaValue < 0 || notaValue > 10)) {
      setMetaReviewError('La nota de calidad debe estar entre 0 y 10.');
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
          <div style={viewerHeaderLeft}>
            <strong>Archivos de la entrega</strong>
            {showCommentSummary && (
              <div style={commentSummaryRow}>
                {codeCommentFileCount > 0 && (
                  <button
                    type="button"
                    style={isCodeListActive ? commentSummaryPillActive : commentSummaryPill}
                    onClick={() =>
                      setCommentListMode((prev) => (prev === 'code' ? '' : 'code'))
                    }
                    title="Ver archivos con comentarios de código"
                  >
                    {codeCommentFileCount} archivo{codeCommentFileCount === 1 ? '' : 's'} con comentarios de código
                  </button>
                )}
                {fileCommentFileCount > 0 && (
                  <button
                    type="button"
                    style={isFileListActive ? commentSummaryPillActive : commentSummaryPill}
                    onClick={() =>
                      setCommentListMode((prev) => (prev === 'file' ? '' : 'file'))
                    }
                    title="Ver archivos con comentarios generales"
                  >
                    {fileCommentFileCount} archivo{fileCommentFileCount === 1 ? '' : 's'} con comentarios generales
                  </button>
                )}
              </div>
            )}
          </div>
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
        {showCommentSummary && commentListMode && activeCommentPaths.length > 0 && (
          <div style={commentSummaryPanel}>
            <div style={commentSummaryHint}>{activeCommentLabel}</div>
            <div style={commentSummaryList}>
              {activeCommentPaths.map((pathValue) => {
                const count = isCodeListActive
                  ? Number(codeCommentCounts[pathValue]) || 0
                  : Number(fileCommentCounts[pathValue]) || 0;
                const label = `${pathValue} (${count})`;
                return (
                  <button
                    key={pathValue}
                    type="button"
                    style={anchorButton}
                    title={pathValue}
                    onClick={() =>
                      (isCodeListActive
                        ? handleOpenCodeCommentFile(pathValue)
                        : handleOpenFileCommentFromList(pathValue))
                    }
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
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
                commentCounts={fileCommentCounts}
                onCommentBadgeClick={handleOpenFileComments}
                codeCommentCounts={codeCommentCounts}
                onCodeCommentBadgeClick={handleOpenCodeCommentFile}
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
              {currentPath && (
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="button" style={linkButton} onClick={handleOpenInNewTab}>
                    Abrir en pestaña nueva
                  </button>
                </div>
              )}
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
                <>
                  {showBinaryPreview ? (
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
                  )}

                  {showFileCommentSection && (
                    <section ref={fileCommentsRef} style={fileCommentPanel}>
                      <div style={fileCommentHeader}>
                        <div>
                          <strong>Comentarios</strong>
                          <div style={miniMeta}>
                            {fileCommentsLoading
                              ? 'Cargando...'
                              : `${fileCommentItems.length} comentario${fileCommentItems.length === 1 ? '' : 's'}`}
                          </div>
                        </div>
                        <div style={fileCommentActions}>
                          {!readOnly && (
                            <button
                              type="button"
                              style={linkButton}
                              onClick={handleOpenFileCommentForm}
                              disabled={fileCommentSaving}
                            >
                              Añadir comentario
                            </button>
                          )}
                        </div>
                      </div>

                      {fileCommentsError && <p style={errorStyle}>{fileCommentsError}</p>}

                      {fileCommentFormOpen && !readOnly && (
                        <div style={fileCommentForm}>
                          <textarea
                            style={fileCommentInput}
                            value={fileCommentDraft}
                            onChange={(event) => setFileCommentDraft(event.target.value)}
                            rows={2}
                            placeholder="Escribe un comentario general sobre este archivo..."
                            disabled={fileCommentSaving}
                          />
                          <button
                            type="button"
                            style={{
                              ...linkButton,
                              opacity: fileCommentSaving ? 0.6 : 1,
                              cursor: fileCommentSaving ? 'wait' : 'pointer'
                            }}
                            onClick={handleAddFileComment}
                            disabled={fileCommentSaving}
                          >
                            {fileCommentSaving ? 'Guardando...' : 'Confirmar'}
                          </button>
                        </div>
                      )}

                      {fileCommentsLoading ? (
                        <p>Cargando comentarios...</p>
                      ) : fileCommentItems.length > 0 ? (
                        <ul style={fileCommentList}>
                          {fileCommentItems.map((item) => (
                            <li key={item.id || item.message} style={fileCommentItem}>
                              <div style={fileCommentMeta}>
                                <span role="img" aria-hidden="true">💬</span>
                                <span title={item.aliasTitle} style={{ fontWeight: 600, color: '#333' }}>
                                  {item.alias}
                                </span>
                                {item.timeText && (
                                  <span title={item.timeTitle}>{item.timeText}</span>
                                )}
                              </div>
                              <div style={fileCommentMessage}>{item.message}</div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p style={fileCommentEmpty}>Todavía no hay comentarios generales.</p>
                      )}
                    </section>
                  )}
                </>
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
                      <small style={miniMeta}>0-10</small>
                      <input
                        style={inputStyle}
                        type="number"
                        step="0.5"
                        min="0"
                        max="10"
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
