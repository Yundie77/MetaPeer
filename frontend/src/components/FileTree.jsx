import React from 'react';

// Árbol de archivos estilo GitHub con carpetas desplegables.
// node: { name, path, isFile, children: node[] }

export default function FileTree({
  nodes = [],
  selectedPath = '',
  expandedPaths = new Set(),
  onToggleDir,
  onOpenFile
}) {
  return (
    <ul style={ulStyle}>
      {nodes.map((node) => (
        <TreeNode
          key={node.path || node.name}
          node={node}
          depth={0}
          selectedPath={selectedPath}
          expandedPaths={expandedPaths}
          onToggleDir={onToggleDir}
          onOpenFile={onOpenFile}
        />
      ))}
    </ul>
  );
}

function TreeNode({ node, depth, selectedPath, expandedPaths, onToggleDir, onOpenFile }) {
  const isDir = !node.isFile;
  const isExpanded = isDir ? expandedPaths.has(node.path) : false;
  const isSelected = selectedPath === node.path;
  const paddingLeft = 12 + depth * 16;

  return (
    <li style={liStyle}>
      {isDir ? (
        <button
          type="button"
          onClick={() => onToggleDir && onToggleDir(node.path)}
          style={{
            ...dirButtonStyle,
            paddingLeft,
          }}
          title={node.path || node.name}
        >
          <span style={{ marginRight: 6 }}>{isExpanded ? '▾' : '▸'}</span>
          <span role="img" aria-hidden="true" style={{ marginRight: 6 }}>📁</span>
          {node.name}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onOpenFile && onOpenFile(node.path)}
          style={{
            ...fileButtonStyle,
            paddingLeft,
            backgroundColor: isSelected ? '#d9ecff' : 'transparent',
            borderColor: isSelected ? '#8cc4ff' : 'transparent'
          }}
          title={node.path}
        >
          <span role="img" aria-hidden="true" style={{ marginRight: 6 }}>📄</span>
          <span style={{ fontFamily: 'Consolas, SFMono-Regular, Menlo, monospace', fontSize: '0.88rem' }}>
            {node.name}
          </span>
        </button>
      )}

      {isDir && isExpanded && node.children && node.children.length > 0 && (
        <ul style={ulStyle}>
          {node.children.map((child) => (
            <TreeNode
              key={child.path || child.name}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              expandedPaths={expandedPaths}
              onToggleDir={onToggleDir}
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
  padding: 0
};

const liStyle = {
  listStyle: 'none'
};

const dirButtonStyle = {
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  textAlign: 'left',
  padding: '0.35rem 0.4rem',
  borderRadius: 4,
  border: '1px solid transparent',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: '0.92rem',
  fontWeight: 600,
  color: '#1f2328'
};

const fileButtonStyle = {
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  textAlign: 'left',
  padding: '0.35rem 0.4rem',
  borderRadius: 4,
  border: '1px solid transparent',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: '0.9rem',
  color: '#24292f'
};
