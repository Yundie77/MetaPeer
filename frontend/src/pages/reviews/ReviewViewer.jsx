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
  linkButton,
  errorStyle
} from './styles.js';
import { findBestPath } from './helpers.js';

export default function ReviewViewer({ revisionId, initialPath = '', initialLine: presetLine = 0, onFileOpened }) {
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
      return;
    }

    // Fallback: leer ?path&line de la URL si no vino por props
    const { path: urlPath, line: urlLine, revisionId: urlRevision } = readFromURL();
    const safeLine = Number.isInteger(urlLine) && urlLine > 0 ? urlLine : 0;
    if (urlPath && (urlRevision === null || Number(urlRevision) === Number(revisionId))) {
      pendingFileRef.current = { path: normalizePath(urlPath), line: safeLine };
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
      if (!Number.isInteger(lineNum) || lineNum <= 0) return;
      const content = (comment.contenido ?? '').trim();
      if (!content) return;
      const list = map.get(lineNum) || [];
      const author = comment.autor?.nombre || 'Revisor';
      const stamp = comment.creado_en ? ` · ${comment.creado_en}` : '';
      list.push(`${author}${stamp}: ${content}`);
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

  const openFile = useCallback(
    async (pathValue, line = 0) => {
      if (!revisionId || !pathValue) return;
      const normalizedPath = normalizePath(pathValue);
      const parsedLine = Number(line);
      const safeLine = Number.isInteger(parsedLine) && parsedLine > 0 ? parsedLine : 0;
      try {
        setFileLoading(true);
        setError('');
        const data = await getJson(`/reviews/${revisionId}/file?path=${encodeURIComponent(normalizedPath)}`);
        if (!data?.path) {
          throw new Error('Archivo inválido');
        }
        setFileData({
          content: data.content || '',
          comments: Array.isArray(data.comments) ? data.comments : [],
          isBinary: data.isBinary,
          path: data.path,
          size: data.size || 0
        });
        setCurrentPath(data.path);
        setInitialLine(safeLine);
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
    if (!revisionId || !currentPath) {
      setError('Selecciona un archivo antes de comentar.');
      return;
    }
    const safeLine = Number(line) || 0;
    if (!safeLine) {
      setError('La línea indicada no es válida.');
      return;
    }
    const lastPath = currentPath;
    try {
      await postJson(`/reviews/${revisionId}/comments`, {
        path: currentPath,
        linea: safeLine,
        contenido: text
      });
      await openFile(lastPath, safeLine);
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
                      const parsed = Number(comment.line);
                      const targetLine = Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
                      openFile(currentPath, targetLine);
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
              <div style={binaryWarning}>Este archivo es binario. Descárgalo para revisarlo por fuera.</div>
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
