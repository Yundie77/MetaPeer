import React, { useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";

const VIEWER_HEIGHT = 520;

// Lista de extensiones consideradas de texto para previsualización.
const TEXT_EXTENSIONS = [
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".py",
  ".java",
  ".c",
  ".cpp",
  ".cs",
  ".rb",
  ".php",
  ".go",
  ".rs",
  ".swift",
  ".kt",
  ".m",
  ".scala",
  ".html",
  ".css",
  ".json",
  ".md",
  ".txt"
];

// Devuelve true si el archivo se puede abrir como texto.
const isTextFile = (filename) => {
  const normalized = filename.toLowerCase();
  return TEXT_EXTENSIONS.some((extension) => normalized.endsWith(extension));
};

// Construye un árbol jerárquico a partir de las entradas del ZIP.
const buildTree = (entries) => {
  const root = new Map();

  entries.forEach((entry) => {
    const normalizedName = entry.name.replace(/\\/g, "/");
    const segments = normalizedName.split("/").filter(Boolean);
    if (!segments.length) {
      return;
    }

    let currentLevel = root;
    let accumulatedPath = "";

    segments.forEach((segment, index) => {
      const isLast = index === segments.length - 1;
      accumulatedPath = accumulatedPath ? `${accumulatedPath}/${segment}` : segment;

      if (!currentLevel.has(segment)) {
        currentLevel.set(segment, {
          name: segment,
          path: accumulatedPath,
          isFile: false,
          entry: undefined,
          children: new Map()
        });
      }

      const node = currentLevel.get(segment);
      if (isLast) {
        node.isFile = !entry.dir;
        node.entry = entry;
      }

      currentLevel = node.children;
    });
  });

  const toArray = (level) =>
    Array.from(level.values())
      .sort((a, b) => {
        if (a.isFile === b.isFile) {
          return a.name.localeCompare(b.name);
        }
        return a.isFile ? 1 : -1;
      })
      .map((node) => ({
        name: node.name,
        path: node.path,
        isFile: node.isFile,
        entry: node.entry,
        children: toArray(node.children)
      }));

  return toArray(root);
};

const treeListStyle = {
  listStyle: "none",
  margin: 0,
  padding: 0
};

const treeFileButtonStyle = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "0.35rem 0.45rem",
  borderRadius: "4px",
  border: "1px solid transparent",
  background: "transparent",
  fontFamily: "Consolas, SFMono-Regular, Menlo, monospace",
  fontSize: "0.85rem",
  cursor: "pointer"
};

const treeFolderStyle = {
  display: "block",
  padding: "0.35rem 0.45rem",
  borderRadius: "4px",
  fontWeight: 600,
  fontFamily: "Consolas, SFMono-Regular, Menlo, monospace",
  fontSize: "0.85rem",
  color: "#333333"
};

function TreeNode({ node, depth, onSelect, selectedPath }) {
  const isSelected = selectedPath === node.path;
  const paddingLeft = `${depth * 14 + 8}px`;

  return (
    <li style={{ listStyle: "none" }}>
      {node.isFile ? (
        <button
          type="button"
          onClick={() => onSelect(node.entry)}
          style={{
            ...treeFileButtonStyle,
            paddingLeft,
            backgroundColor: isSelected ? "#d9ecff" : "transparent",
            borderColor: isSelected ? "#8cc4ff" : "transparent"
          }}
        >
          {node.name}
        </button>
      ) : (
        <div
          style={{
            ...treeFolderStyle,
            paddingLeft,
            backgroundColor: "transparent"
          }}
        >
          [DIR] {node.name}
        </div>
      )}
      {node.children.length > 0 && (
        <ul style={treeListStyle}>
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              onSelect={onSelect}
              selectedPath={selectedPath}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function FileTree({ nodes, onSelect, selectedPath }) {
  if (!nodes.length) {
    return <p style={{ color: "#555", margin: 0 }}>El ZIP no contiene ficheros.</p>;
  }
  return (
    <ul style={treeListStyle}>
      {nodes.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          depth={0}
          onSelect={onSelect}
          selectedPath={selectedPath}
        />
      ))}
    </ul>
  );
}

export default function ZipViewer() {
  const [zipEntries, setZipEntries] = useState([]);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [fileContents, setFileContents] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  // Reiniciamos la selección cuando cambia el ZIP cargado.
  useEffect(() => {
    setSelectedEntry(null);
    setFileContents("");
  }, [zipEntries]);

  const treeData = useMemo(() => buildTree(zipEntries), [zipEntries]);

  // Lee el ZIP en memoria, lista los ficheros y muestra errores si falla.
  const handleZipUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsBusy(true);
    setErrorMessage("");
    setZipEntries([]);

    try {
      const data = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(data);
      const entries = Object.values(zip.files).filter((entry) => !entry.dir);

      if (!entries.length) {
        setErrorMessage("El archivo ZIP no contiene ficheros.");
      }

      setZipEntries(entries);
    } catch (error) {
      console.error("ZIP parsing failed", error);
      setErrorMessage("No se pudo leer el archivo ZIP. Comprueba que sea válido.");
    } finally {
      setIsBusy(false);
    }
  };

  // Abre un fichero del ZIP y lo decodifica en UTF-8 para CodeMirror.
  const openEntry = async (entry) => {
    setSelectedEntry(entry);
    setFileContents("");
    setErrorMessage("");

    if (!isTextFile(entry.name)) {
      setErrorMessage("Solo se pueden previsualizar ficheros de texto.");
      return;
    }

    setIsBusy(true);
    try {
      const bytes = await entry.async("uint8array");
      const decoder = new TextDecoder("utf-8", { fatal: false });
      const decoded = decoder.decode(bytes);
      setFileContents(decoded);
    } catch (error) {
      console.error("File decoding failed", error);
      setErrorMessage("No se pudo leer el contenido del fichero seleccionado.");
    } finally {
      setIsBusy(false);
    }
  };

  const selectedPath = selectedEntry?.name || "";

  return (
    <div style={wrapperStyle}>
      <label htmlFor="zip-input" style={{ fontWeight: 600 }}>
        Selecciona una entrega (.zip):
      </label>
      <input
        id="zip-input"
        type="file"
        accept=".zip"
        onChange={handleZipUpload}
        style={inputStyle}
      />

      {isBusy && <p style={{ color: "#555" }}>Procesando archivo…</p>}
      {errorMessage && <p style={{ color: "crimson" }}>{errorMessage}</p>}

      {!zipEntries.length && !errorMessage && (
        <p style={{ color: "#555" }}>Sube un ZIP para ver su contenido.</p>
      )}

      {!!zipEntries.length && (
        <div style={viewerLayoutStyle}>
          <div style={treePaneStyle}>
            <div style={treeHeaderStyle}>Estructura del ZIP</div>
            <div style={treeScrollStyle}>
              <FileTree nodes={treeData} onSelect={openEntry} selectedPath={selectedPath} />
            </div>
          </div>

          <div style={editorColumnStyle}>
            <div style={selectedPathStyle}>
              {selectedPath ? selectedPath : "Selecciona un fichero para previsualizarlo"}
            </div>
            <div style={editorShellStyle}>
              {selectedEntry ? (
                isTextFile(selectedEntry.name) ? (
                  isBusy && !fileContents ? (
                    <p style={placeholderStyle}>Cargando contenido…</p>
                  ) : (
                    <CodeMirror
                      value={fileContents}
                      height="100%"
                      extensions={[javascript()]}
                      editable={false}
                      basicSetup={{
                        highlightActiveLine: false,
                        highlightActiveLineGutter: false
                      }}
                      style={{ flex: 1 }}
                    />
                  )
                ) : (
                  <p style={placeholderStyle}>El fichero seleccionado no es de texto.</p>
                )
              ) : (
                <p style={placeholderStyle}>Selecciona un fichero para previsualizarlo.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const wrapperStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "1rem"
};

const inputStyle = {
  border: "1px solid #ccc",
  padding: "0.5rem",
  borderRadius: "4px"
};

const viewerLayoutStyle = {
  display: "grid",
  gridTemplateColumns: "320px 1fr",
  gap: "1.5rem"
};

const treePaneStyle = {
  display: "flex",
  flexDirection: "column",
  border: "1px solid #ddd",
  borderRadius: "6px",
  backgroundColor: "#fdfdfd",
  height: `${VIEWER_HEIGHT}px`
};

const treeHeaderStyle = {
  padding: "0.5rem 0.75rem",
  fontWeight: 600,
  borderBottom: "1px solid #ececec",
  backgroundColor: "#f5f7fb"
};

const treeScrollStyle = {
  flex: 1,
  overflowY: "auto",
  padding: "0.5rem"
};

const editorColumnStyle = {
  display: "flex",
  flexDirection: "column",
  height: `${VIEWER_HEIGHT}px`
};

const selectedPathStyle = {
  minHeight: "2.5rem",
  padding: "0.5rem 0.75rem",
  fontWeight: 600,
  border: "1px solid #ddd",
  borderRadius: "6px 6px 0 0",
  backgroundColor: "#f5f7fb",
  color: "#1a1a1a",
  overflowWrap: "anywhere"
};

const editorShellStyle = {
  flex: 1,
  border: "1px solid #ddd",
  borderTop: "none",
  borderRadius: "0 0 6px 6px",
  backgroundColor: "#fafafa",
  padding: "0.5rem",
  display: "flex"
};

const placeholderStyle = {
  margin: "auto",
  color: "#555"
};
