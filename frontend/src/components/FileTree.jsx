import React from 'react';
import { useEffect, useRef } from 'react';

// Árbol de archivos estilo GitHub con carpetas desplegables.
// node: { name, path, isFile, children: node[] }

export default function FileTree({
  nodes = [],
  selectedPath = '',
  expandedPaths = new Set(),
  onToggleDir,
  onOpenFile,
  commentCounts = {},
  onCommentBadgeClick
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
          commentCounts={commentCounts}
          onCommentBadgeClick={onCommentBadgeClick}
        />
      ))}
    </ul>
  );
}

function TreeNode({ node, depth, selectedPath, expandedPaths, onToggleDir, onOpenFile, commentCounts, onCommentBadgeClick }) {
  const isDir = !node.isFile;
  const isExpanded = isDir ? expandedPaths.has(node.path) : false;
  const isSelected = selectedPath === node.path;
  const paddingLeft = 12 + depth * 16;
  const nodeRef = useRef(null);
  const commentCount = getCommentCount(commentCounts, node.path);

  useEffect(() => {
    if (isSelected && nodeRef.current) {
      nodeRef.current.scrollIntoView({ block: 'nearest', inline: 'start' });
    }
  }, [isSelected]);

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
        <div style={fileRowStyle}>
          <button
            type="button"
            ref={nodeRef}
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
          {commentCount > 0 && (
            <button
              type="button"
              style={commentBadgeStyle}
              onClick={() => onCommentBadgeClick && onCommentBadgeClick(node.path)}
              title="Ver comentarios generales"
            >
              {commentCount} comentario{commentCount === 1 ? '' : 's'}
            </button>
          )}
        </div>
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
              commentCounts={commentCounts}
              onCommentBadgeClick={onCommentBadgeClick}
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
  whiteSpace: 'nowrap',
  minWidth: '100%',
  width: 'max-content'
};

const liStyle = {
  listStyle: 'none'
};

const fileRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.4rem'
};

const dirButtonStyle = {
  display: 'flex',
  alignItems: 'center',
  width: 'max-content',
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
  width: 'max-content',
  textAlign: 'left',
  padding: '0.35rem 0.4rem',
  borderRadius: 4,
  border: '1px solid transparent',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: '0.9rem',
  color: '#24292f'
};

const commentBadgeStyle = {
  border: '1px solid #2563eb',
  background: '#eff6ff',
  color: '#1e3a8a',
  borderRadius: '999px',
  padding: '0.1rem 0.5rem',
  fontSize: '0.72rem',
  fontWeight: 600,
  cursor: 'pointer'
};

function getCommentCount(commentCounts, path) {
  if (!commentCounts || !path) return 0;
  if (commentCounts instanceof Map) {
    return Number(commentCounts.get(path)) || 0;
  }
  return Number(commentCounts[path]) || 0;
}
