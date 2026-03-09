import React from 'react';
import {
  errorStyle,
  linkButton,
  viewerCard,
  viewerHeader,
  viewerHeaderLeft
} from './stylesReview.js';
import ReviewCommentSummary from './ReviewCommentSummary.jsx';
import ReviewWorkspace from './ReviewWorkspace.jsx';

export default function ReviewMainCard({
  submissionId,
  downloading,
  onDownloadZip,
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
  onOpenFileCommentFromList,
  error,
  treeLoading,
  hasFiles,
  workspaceProps
}) {
  return (
    <div style={viewerCard}>
      <div style={viewerHeader}>
        <div style={viewerHeaderLeft}>
          <strong>Archivos de la entrega</strong>
          <ReviewCommentSummary
            mode="pills"
            showCommentSummary={showCommentSummary}
            codeCommentFileCount={codeCommentFileCount}
            fileCommentFileCount={fileCommentFileCount}
            isCodeListActive={isCodeListActive}
            isFileListActive={isFileListActive}
            onToggleCodeList={onToggleCodeList}
            onToggleFileList={onToggleFileList}
          />
        </div>
        {submissionId && (
          <button
            type="button"
            style={{
              ...linkButton,
              opacity: downloading ? 0.6 : 1,
              cursor: downloading ? 'wait' : 'pointer'
            }}
            onClick={onDownloadZip}
            disabled={downloading}
          >
            {downloading ? 'Descargando...' : 'Descargar ZIP'}
          </button>
        )}
      </div>
      <ReviewCommentSummary
        mode="panel"
        showCommentSummary={showCommentSummary}
        commentListMode={commentListMode}
        activeCommentPaths={activeCommentPaths}
        activeCommentLabel={activeCommentLabel}
        isCodeListActive={isCodeListActive}
        codeCommentCounts={codeCommentCounts}
        fileCommentCounts={fileCommentCounts}
        onOpenCodeCommentFile={onOpenCodeCommentFile}
        onOpenFileCommentFromList={onOpenFileCommentFromList}
      />
      {error && <p style={errorStyle}>{error}</p>}
      {treeLoading ? (
        <p>Cargando archivos...</p>
      ) : !hasFiles ? (
        <p>No hay archivos para esta entrega.</p>
      ) : (
        <ReviewWorkspace {...workspaceProps} />
      )}
    </div>
  );
}
