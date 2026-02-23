import React, { useEffect, useMemo, useState } from 'react';
import JSZip from 'jszip';
import FileTree from './FileTree.jsx';
import Breadcrumbs from './Breadcrumbs.jsx';
import EditorPane from './EditorPane.jsx';
import {
  zipViewerContainer,
  zipViewerErrorText,
  zipViewerFileInput,
  zipViewerLabel,
  zipViewerLeftHeader,
  zipViewerLeftPane,
  zipViewerLeftScroll,
  zipViewerPlaceholder,
  zipViewerRightContent,
  zipViewerRightPane,
  zipViewerStatusText,
  zipViewerViewerArea
} from './stylesFileViewer.js';
import { isTextFile } from '../utils/textFileTypes.js';
import { readFromURL, writeToURL } from '../utils/permalink.js';
import { ancestors, buildTreeFromPaths, collectDirPaths, normalizePath } from '../utils/fileTreeHelpers.js';

// Visor ZIP: árbol + editor

export default function ZipViewer() {
  const [zipEntries, setZipEntries] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const [currentPath, setCurrentPath] = useState('');
  const [initialLine, setInitialLine] = useState(0);

  const [fileContents, setFileContents] = useState('');
  const [notText, setNotText] = useState(false);

  // clave `${path}:${line}` => array de comentarios
  const [comments, setComments] = useState(new Map());

  // Set de rutas tipo "folder" o "folder/sub"
  const [expandedPaths, setExpandedPaths] = useState(new Set());

  // Leer ?path&line
  useEffect(() => {
    const { path, line } = readFromURL();
    if (path) setCurrentPath(path);
    if (line) setInitialLine(line);
  }, []);

  // Sin router: mantener ?path actualizado cuando abrimos un archivo
  useEffect(() => {
    if (currentPath) {
      writeToURL({ path: currentPath, line: undefined });
      expandToPath(currentPath);
    }
  }, [currentPath]);

  // Construir árbol completo a partir de las entradas ZIP
  const entryNames = useMemo(() => zipEntries.map((entry) => normalizePath(entry.name)), [zipEntries]);
  const treeData = useMemo(() => buildTreeFromPaths(entryNames), [entryNames]);

  // Comentarios del archivo abierto listos para el editor (Map<number, string[]>)
  const commentsForFile = useMemo(() => {
    const map = new Map();
    comments.forEach((list, key) => {
      const [p, ln] = key.split(':');
      if (p === currentPath) {
        const n = Number(ln) || 0;
        map.set(n, list);
      }
    });
    return map;
  }, [comments, currentPath]);

  // Subir ZIP: se lee en memoria y se construyen las entradas
  const handleZipUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsBusy(true);
    setErrorMessage('');
    setZipEntries([]);
    setExpandedPaths(new Set());
    try {
      const data = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(data);
      const entries = Object.values(zip.files).filter((entry) => !entry.dir);
      setZipEntries(entries);
      const names = entries.map((entry) => normalizePath(entry.name));
      setExpandedPaths(new Set(collectDirPaths(names)));

      // Si la URL traía ?path=&line= intentar abrir automáticamente
      const { path, line } = readFromURL();
      if (path && entries.some((e) => normalizePath(e.name) === normalizePath(path))) {
        openByPath(path, line || 0, entries);
      }
    } catch (error) {
      console.error('ZIP parsing failed', error);
      setErrorMessage('No se pudo leer el archivo ZIP. Comprueba que sea válido.');
    } finally {
      setIsBusy(false);
    }
  };

  // Abre un archivo por su ruta dentro del ZIP
  const openByPath = async (path, line = 0, entries = zipEntries) => {
    const normalizedPath = normalizePath(path);
    const entry = entries.find((e) => normalizePath(e.name) === normalizedPath);
    setCurrentPath(normalizedPath);
    setInitialLine(line || 0);
    if (!entry) return;

    if (!isTextFile(normalizedPath)) {
      setNotText(true);
      setFileContents('');
      return;
    }

    setNotText(false);
    try {
      const bytes = await entry.async('uint8array');
      const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
      setFileContents(decoded);
    } catch (error) {
      console.error('File decoding failed', error);
      setErrorMessage('No se pudo leer el contenido del fichero seleccionado.');
    }
  };

  // Añadir comentario en memoria
  const handleAddComment = (line, text) => {
    if (!currentPath || !line) return;
    const key = `${currentPath}:${line}`;
    setComments((prev) => {
      const next = new Map(prev);
      const current = next.get(key) || [];
      next.set(key, [...current, text]);
      return next;
    });
  };

  // Toggles de carpetas
  const toggleDir = (dirPath) => {
    if (!dirPath) return;
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(dirPath)) {
        next.delete(dirPath);
      } else {
        next.add(dirPath);
      }
      return next;
    });
  };

  // Expandir todos los ancestros de una ruta (para que el archivo sea visible)
  const expandToPath = (path) => {
    const dirs = ancestors(path);
    if (!dirs.length) return;
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      dirs.forEach((dir) => next.add(dir));
      return next;
    });
  };

  // Breadcrumbs: al hacer clic en un segmento expandimos la carpeta correspondiente
  const handleBreadcrumbNav = (segPath) => {
    if (!segPath) {
      setExpandedPaths(new Set(collectDirPaths(entryNames)));
      return;
    }
    expandToPath(segPath);
  };

  return (
    <div style={zipViewerContainer}>
      <label htmlFor="zip-input" style={zipViewerLabel}>Selecciona una entrega (.zip):</label>
      <input id="zip-input" type="file" accept=".zip" onChange={handleZipUpload} style={zipViewerFileInput} />

      {isBusy && <p style={zipViewerStatusText}>Procesando archivo…</p>}
      {errorMessage && <p style={zipViewerErrorText}>{errorMessage}</p>}

      {!zipEntries.length && !errorMessage && (
        <p style={zipViewerStatusText}>Sube un ZIP para ver su contenido.</p>
      )}

      {!!zipEntries.length && (
        <div style={zipViewerViewerArea}>
          <aside style={zipViewerLeftPane}>
            <div style={zipViewerLeftHeader}>Estructura</div>
            <div style={zipViewerLeftScroll}>
              <FileTree
                nodes={treeData}
                selectedPath={currentPath}
                expandedPaths={expandedPaths}
                onToggleDir={toggleDir}
                onOpenFile={(p) => openByPath(p)}
              />
            </div>
          </aside>

          <div style={zipViewerRightPane}>
            <Breadcrumbs path={currentPath} onNavigate={handleBreadcrumbNav} />
            <div style={zipViewerRightContent}>
              {currentPath ? (
                notText ? (
                  <div style={zipViewerPlaceholder}>Este fichero no es de texto</div>
                ) : (
                  <EditorPane
                    path={currentPath}
                    code={fileContents}
                    height={'100%'}
                    initialLine={initialLine}
                    commentsByLine={commentsForFile}
                    onAddComment={handleAddComment}
                  />
                )
              ) : (
                <div style={zipViewerPlaceholder}>Selecciona un fichero para previsualizarlo</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

