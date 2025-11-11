import React, { useEffect, useMemo, useState } from 'react';
import JSZip from 'jszip';
import FileTree from './FileTree.jsx';
import Breadcrumbs from './Breadcrumbs.jsx';
import EditorPane from './EditorPane.jsx';
import { isTextFile } from '../utils/textFileTypes.js';
import { readFromURL, writeToURL } from '../utils/permalink.js';
import { ancestors, buildTreeFromPaths, collectDirPaths, normalizePath } from '../utils/fileTreeHelpers.js';

// Visor ZIP dividido en dos columnas tipo GitHub:
// - Izquierda: árbol completo con carpetas desplegables.
// - Derecha: breadcrumb + editor con resaltado y comentarios.

export default function ZipViewer() {
  const [zipEntries, setZipEntries] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  // Archivo abierto actualmente y línea inicial (permalink)
  const [currentPath, setCurrentPath] = useState('');
  const [initialLine, setInitialLine] = useState(0);

  // Contenido del archivo + flag para archivos no texto
  const [fileContents, setFileContents] = useState('');
  const [notText, setNotText] = useState(false);

  // Comentarios en memoria (clave `${path}:${line}` => array de comentarios)
  const [comments, setComments] = useState(new Map());

  // Carpetas desplegadas (Set de rutas tipo "folder" o "folder/sub")
  const [expandedPaths, setExpandedPaths] = useState(new Set());

  // Leer ?path&line al cargar la página (permite recargar con enlaces directos)
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
    <div style={container}>
      <label htmlFor="zip-input" style={{ fontWeight: 600 }}>Selecciona una entrega (.zip):</label>
      <input id="zip-input" type="file" accept=".zip" onChange={handleZipUpload} style={fileInput} />

      {isBusy && <p style={{ color: '#555' }}>Procesando archivo…</p>}
      {errorMessage && <p style={{ color: 'crimson' }}>{errorMessage}</p>}

      {!zipEntries.length && !errorMessage && (
        <p style={{ color: '#555' }}>Sube un ZIP para ver su contenido.</p>
      )}

      {!!zipEntries.length && (
        <div style={viewerArea}>
          <aside style={leftPane}>
            <div style={leftHeader}>Estructura</div>
            <div style={leftScroll}>
              <FileTree
                nodes={treeData}
                selectedPath={currentPath}
                expandedPaths={expandedPaths}
                onToggleDir={toggleDir}
                onOpenFile={(p) => openByPath(p)}
              />
            </div>
          </aside>

          <div style={rightPane}>
            <Breadcrumbs path={currentPath} onNavigate={handleBreadcrumbNav} />
            <div style={{ flex: 1, display: 'flex' }}>
              {currentPath ? (
                notText ? (
                  <div style={placeholder}>Este fichero no es de texto</div>
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
                <div style={placeholder}>Selecciona un fichero para previsualizarlo</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Estilos: layout fijo a dos columnas con scroll independiente a la izquierda
const container = { display: 'flex', flexDirection: 'column', gap: '1rem' };
const fileInput = { border: '1px solid #ccc', padding: '0.5rem', borderRadius: 4 };

const viewerArea = {
  display: 'grid',
  gridTemplateColumns: '340px 1fr',
  gap: '1rem',
  minHeight: 'calc(100vh - 200px)'
};

const leftPane = {
  display: 'flex',
  flexDirection: 'column',
  border: '1px solid #ddd',
  borderRadius: 6,
  background: '#fdfdfd',
  height: 'calc(100vh - 200px)',
  position: 'sticky',
  top: 96
};

const leftHeader = {
  padding: '0.5rem 0.75rem',
  fontWeight: 600,
  borderBottom: '1px solid #ececec',
  background: '#f5f7fb'
};

const leftScroll = {
  flex: 1,
  overflowY: 'auto',
  padding: '0.5rem'
};

const rightPane = {
  display: 'flex',
  flexDirection: 'column',
  minHeight: 'calc(100vh - 200px)'
};

const placeholder = {
  margin: 'auto',
  color: '#555',
  border: '1px dashed #ddd',
  borderRadius: 6,
  padding: '1rem',
  width: '100%',
  textAlign: 'center'
};
