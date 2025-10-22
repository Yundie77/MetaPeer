import React from 'react';

// Árbol de archivos/carpetas muy simple.
// Recibe nodos ya construidos (carpetas arriba, archivos abajo)
// y permite seleccionar carpeta o archivo.

/**
 * node shape: { name, path, isFile, children: node[] }
 */
export default function FileTree({ nodes = [], selectedPath = '', onOpenDir, onOpenFile }) {
  return (
    <ul style={ulStyle}>
      {nodes.map((n) => (
        <TreeNode
          key={n.path || n.name}
          node={n}
          depth={0}
          selectedPath={selectedPath}
          onOpenDir={onOpenDir}
          onOpenFile={onOpenFile}
        />
      ))}
    </ul>
  );
}

function TreeNode({ node, depth, selectedPath, onOpenDir, onOpenFile }) {
  const isSelected = selectedPath === node.path;
  const pad = 8 + depth * 14;
  const isDir = !node.isFile;

  return (
    <li style={liStyle}>
      {isDir ? (
        <button
          type="button"
          onClick={() => onOpenDir && onOpenDir(node.path)}
          style={{
            ...btnBase,
            paddingLeft: pad,
            fontWeight: 600,
          }}
          title={node.path || node.name}
        >
          📁 {node.name}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onOpenFile && onOpenFile(node.path)}
          style={{
            ...btnBase,
            paddingLeft: pad,
            backgroundColor: isSelected ? '#d9ecff' : 'transparent',
            borderColor: isSelected ? '#8cc4ff' : 'transparent',
            fontFamily: 'Consolas, SFMono-Regular, Menlo, monospace'
          }}
          title={node.path}
        >
          📄 {node.name}
        </button>
      )}

      {node.children && node.children.length > 0 && (
        <ul style={ulStyle}>
          {node.children.map((c) => (
            <TreeNode
              key={c.path || c.name}
              node={c}
              depth={depth + 1}
              selectedPath={selectedPath}
              onOpenDir={onOpenDir}
              onOpenFile={onOpenFile}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

const ulStyle = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
};

const liStyle = {
  listStyle: 'none'
};

const btnBase = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '0.35rem 0.45rem',
  borderRadius: '4px',
  border: '1px solid transparent',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: '0.9rem',
  color: '#222'
};

