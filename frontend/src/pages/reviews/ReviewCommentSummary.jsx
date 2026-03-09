import React from 'react';
import {
  anchorButton,
  commentSummaryHint,
  commentSummaryList,
  commentSummaryPanel,
  commentSummaryPill,
  commentSummaryPillActive,
  commentSummaryRow
} from './stylesReview.js';

export default function ReviewCommentSummary({
  mode = 'pills',
  showCommentSummary,
  codeCommentFileCount,
  fileCommentFileCount,
  isCodeListActive,
  isFileListActive,
  onToggleCodeList,
  onToggleFileList,
  commentListMode,
  activeCommentPaths,
  activeCommentLabel,
  codeCommentCounts,
  fileCommentCounts,
  onOpenCodeCommentFile,
  onOpenFileCommentFromList
}) {
  if (!showCommentSummary) {
    return null;
  }

  if (mode === 'panel') {
    if (!commentListMode || activeCommentPaths.length === 0) {
      return null;
    }

    return (
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
                    ? onOpenCodeCommentFile(pathValue)
                    : onOpenFileCommentFromList(pathValue))
                }
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div style={commentSummaryRow}>
      {codeCommentFileCount > 0 && (
        <button
          type="button"
          style={isCodeListActive ? commentSummaryPillActive : commentSummaryPill}
          onClick={onToggleCodeList}
          title="Ver archivos con comentarios de código"
        >
          {codeCommentFileCount} archivo{codeCommentFileCount === 1 ? '' : 's'} con comentarios de código
        </button>
      )}
      {fileCommentFileCount > 0 && (
        <button
          type="button"
          style={isFileListActive ? commentSummaryPillActive : commentSummaryPill}
          onClick={onToggleFileList}
          title="Ver archivos con comentarios generales"
        >
          {fileCommentFileCount} archivo{fileCommentFileCount === 1 ? '' : 's'} con comentarios generales
        </button>
      )}
    </div>
  );
}

