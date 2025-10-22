import React, { useEffect, useMemo, useState } from 'react';
import JSZip from 'jszip';
import FileTree from './FileTree.jsx';
import Breadcrumbs from './Breadcrumbs.jsx';
import EditorPane from './EditorPane.jsx';
import { isTextFile } from '../utils/textFileTypes.js';
import { readFromURL, writeToURL } from '../utils/permalink.js';

// Componente principal: orquesta carga del ZIP, árbol, breadcrumbs y editor.
// Código comentado y simple para aprender la estructura.

export default function ZipViewer() {
  // Entradas del ZIP (solo archivos, no carpetas)
  const [zipEntries, setZipEntries] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  // Navegación y selección
  const [currentDir, setCurrentDir] = useState(''); // carpeta actual (filtra el árbol)
  const [currentPath, setCurrentPath] = useState(''); // archivo seleccionado
  const [initialLine, setInitialLine] = useState(0); // línea a resaltar/scroll si viene de permalink

  // Contenido del archivo seleccionado
  const [fileContents, setFileContents] = useState('');
  const [notText, setNotText] = useState(false);

  // Comentarios en memoria: Map("path:line" => string[])
  const [comments, setComments] = useState(new Map());

  // Al cargar, leemos ?path&line (permite recargar con permalink)
  useEffect(() => {
    const { path, line } = readFromURL();
    if (path) setCurrentPath(path);
    if (line) setInitialLine(line);
  }, []);

  // Cuando cambia el archivo abierto, escribimos ?path= en la URL (sin router)
  useEffect(() => {
    if (currentPath) writeToURL({ path: currentPath, line: undefined });
  }, [currentPath]);

  // Árbol de archivos filtrado por currentDir
  const treeData = useMemo(() => buildTree(zipEntries, currentDir), [zipEntries, currentDir]);

  // Subir ZIP y leer entradas
  const handleZipUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsBusy(true);
    setErrorMessage('');
    setZipEntries([]);
    setCurrentDir('');
    try {
      const data = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(data);
      const entries = Object.values(zip.files).filter((e) => !e.dir);
      setZipEntries(entries);
      // Si la URL ya traía path/line, intentamos abrir tras cargar
      const { path, line } = readFromURL();
      if (path && entries.some((e) => normalize(e.name) === normalize(path))) {
        openByPath(path, line || 0, entries);
      }
    } catch (err) {
      console.error('ZIP parsing failed', err);
      setErrorMessage('No se pudo leer el archivo ZIP. Comprueba que sea válido.');
    } finally {
      setIsBusy(false);
    }
  };

  // Abrir archivo por ruta (desde árbol o permalink)
  const openByPath = async (path, line = 0, entries = zipEntries) => {
    const entry = entries.find((e) => normalize(e.name) === normalize(path));
    setCurrentPath(path);
    setInitialLine(line || 0);
    if (!entry) return;
    if (!isTextFile(path)) {
      setNotText(true);
      setFileContents('');
      return;
    }
    setNotText(false);
    try {
      const bytes = await entry.async('uint8array');
      const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
      setFileContents(decoded);
    } catch (err) {
      console.error('File decoding failed', err);
      setErrorMessage('No se pudo leer el contenido del fichero seleccionado.');
    }
  };

  // Añadir comentario a una línea del archivo abierto
  const handleAddComment = (line, text) => {
    if (!currentPath) return;
    const key = `${currentPath}:${line}`;
    setComments((prev) => {
      const next = new Map(prev);
      const arr = next.get(key) || [];
      next.set(key, [...arr, text]);
      return next;
    });
  };

  // Comentarios del archivo actual como Map<number, string[]>
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

  // Breadcrumbs: navegar a directorios
  const handleBreadcrumbNav = (segPath) => setCurrentDir(segPath);

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
          {/* Panel izquierdo: árbol filtrado por currentDir */}
          <div style={leftPane}>
            <div style={leftHeader}>Estructura</div>
            <div style={leftScroll}>
              <FileTree
                nodes={treeData}
                selectedPath={currentPath}
                onOpenDir={setCurrentDir}
                onOpenFile={(p) => openByPath(p)}
              />
            </div>
          </div>

          {/* Panel derecho: breadcrumbs + editor */}
          <div style={rightPane}>
            <Breadcrumbs path={currentPath || currentDir} onNavigate={handleBreadcrumbNav} />
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

// Construye árbol simple desde las entradas del ZIP, filtrando por currentDir
function buildTree(entries, currentDir) {
  const normDir = normalize(currentDir);
  const root = new Map();
  const ensure = (level, name, path) => {
    if (!level.has(name)) level.set(name, { name, path, isFile: false, children: new Map() });
    return level.get(name);
  };

  entries.forEach((e) => {
    const full = normalize(e.name);
    const segs = full.split('/').filter(Boolean);
    if (!segs.length) return;

    if (normDir && !full.startsWith(normDir + '/')) return;
    const relevant = normDir ? full.slice(normDir.length + 1) : full;
    const parts = relevant.split('/').filter(Boolean);

    let level = root;
    let acc = normDir || '';
    parts.forEach((part, idx) => {
      const isLast = idx === parts.length - 1;
      acc = acc ? `${acc}/${part}` : part;
      const node = ensure(level, part, acc);
      if (isLast) node.isFile = true;
      level = node.children;
    });
  });

  const toArray = (level) =>
    Array.from(level.values())
      .sort((a, b) => (a.isFile === b.isFile ? a.name.localeCompare(b.name) : a.isFile ? 1 : -1))
      .map((n) => ({ ...n, children: toArray(n.children) }));

  return toArray(root);
}

function normalize(p = '') { return p.replace(/\\/g, '/').replace(/^\/+|\/+$/g, ''); }

// Estilos simples y responsivos
const container = { display: 'flex', flexDirection: 'column', gap: '1rem' };
const fileInput = { border: '1px solid #ccc', padding: '0.5rem', borderRadius: 4 };
const viewerArea = { display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1rem', height: 'calc(100vh - 220px)' };
const leftPane = { display: 'flex', flexDirection: 'column', border: '1px solid #ddd', borderRadius: 6, background: '#fdfdfd' };
const leftHeader = { padding: '0.5rem 0.75rem', fontWeight: 600, borderBottom: '1px solid #ececec', background: '#f5f7fb' };
const leftScroll = { flex: 1, overflowY: 'auto', padding: '0.5rem' };
const rightPane = { display: 'flex', flexDirection: 'column' };
const placeholder = { margin: 'auto', color: '#555', border: '1px dashed #ddd', borderRadius: 6, padding: '1rem', width: '100%', textAlign: 'center' };

