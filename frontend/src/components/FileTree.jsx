import React from 'react';
import { useEffect, useRef } from 'react';
import {
  fileTreeCommentBadge,
  fileTreeDirButtonAtDepth,
  fileTreeFileButtonAtDepth,
  fileTreeItem,
  fileTreeList,
  fileTreeRow,
  iconGap6,
  viewerTextFileName
} from './stylesFileViewer.js';

// node: { name, path, isFile, children: node[] }

export default function FileTree({
  nodes = [],
  selectedPath = '',
  expandedPaths = new Set(),
  onToggleDir,
  onOpenFile,
  commentCounts = {},
  onCommentBadgeClick,
  codeCommentCounts = {},
  onCodeCommentBadgeClick
}) {
  return (
    <ul style={fileTreeList}>
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
          codeCommentCounts={codeCommentCounts}
          onCodeCommentBadgeClick={onCodeCommentBadgeClick}
        />
      ))}
    </ul>
  );
}

function TreeNode({
  node,
  depth,
  selectedPath,
  expandedPaths,
  onToggleDir,
  onOpenFile,
  commentCounts,
  onCommentBadgeClick,
  codeCommentCounts,
  onCodeCommentBadgeClick
}) {
  const isDir = !node.isFile;
  const isExpanded = isDir ? expandedPaths.has(node.path) : false;
  const isSelected = selectedPath === node.path;
  const paddingLeft = 12 + depth * 16;
  const nodeRef = useRef(null);
  const commentCount = getCommentCount(commentCounts, node.path);
  const codeCommentCount = getCommentCount(codeCommentCounts, node.path);

  useEffect(() => {
    if (isSelected && nodeRef.current) {
      nodeRef.current.scrollIntoView({ block: 'nearest', inline: 'start' });
    }
  }, [isSelected]);

  return (
    <li style={fileTreeItem}>
      {isDir ? (
        <button
          type="button"
          onClick={() => onToggleDir && onToggleDir(node.path)}
          style={fileTreeDirButtonAtDepth(paddingLeft)}
          title={node.path || node.name}
        >
          <span style={iconGap6}>{isExpanded ? '▾' : '▸'}</span>
          <span role="img" aria-hidden="true" style={iconGap6}>📁</span>
          {node.name}
        </button>
      ) : (
        <div style={fileTreeRow}>
          <button
            type="button"
            ref={nodeRef}
            onClick={() => onOpenFile && onOpenFile(node.path)}
            style={fileTreeFileButtonAtDepth(paddingLeft, isSelected)}
            title={node.path}
          >
            <span role="img" aria-hidden="true" style={iconGap6}>📄</span>
            <span style={viewerTextFileName}>
              {node.name}
            </span>
          </button>
          {codeCommentCount > 0 && (
            <button
              type="button"
              style={fileTreeCommentBadge}
              onClick={() => onCodeCommentBadgeClick && onCodeCommentBadgeClick(node.path)}
              title="Ver comentarios de código"
            >
              {codeCommentCount} comentario{codeCommentCount === 1 ? '' : 's'}
            </button>
          )}
          {commentCount > 0 && (
            <button
              type="button"
              style={fileTreeCommentBadge}
              onClick={() => onCommentBadgeClick && onCommentBadgeClick(node.path)}
              title="Ver comentarios generales"
            >
              {commentCount} comentario{commentCount === 1 ? '' : 's'}
            </button>
          )}
        </div>
      )}

      {isDir && isExpanded && node.children && node.children.length > 0 && (
        <ul style={fileTreeList}>
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
              codeCommentCounts={codeCommentCounts}
              onCodeCommentBadgeClick={onCodeCommentBadgeClick}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function getCommentCount(commentCounts, path) {
  if (!commentCounts || !path) return 0;
  if (commentCounts instanceof Map) {
    return Number(commentCounts.get(path)) || 0;
  }
  return Number(commentCounts[path]) || 0;
}
