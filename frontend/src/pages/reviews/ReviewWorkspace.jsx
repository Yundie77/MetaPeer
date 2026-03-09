import React from 'react';
import FileTree from '../../components/FileTree.jsx';
import Breadcrumbs from '../../components/Breadcrumbs.jsx';
import EditorPane from '../../components/EditorPane.jsx';
import ReviewFileCommentSection from './ReviewFileCommentSection.jsx';
import {
  anchorBar,
  anchorButton,
  binaryWarning,
  linkButton,
  previewFrame,
  previewWrapper,
  splitHandle,
  viewerContent,
  viewerGrid,
  viewerSidebar
} from './stylesReview.js';

export default function ReviewWorkspace({
  splitRef,
  sidebarWidth,
  onStartDrag,
  treeData,
  currentPath,
  expandedPaths,
  onToggleDir,
  onOpenFile,
  fileCommentCounts,
  onCommentBadgeClick,
  codeCommentCounts,
  onCodeCommentBadgeClick,
  onBreadcrumbNavigate,
  onOpenInNewTab,
  commentAnchors,
  onOpenCommentAnchor,
  fileLoading,
  shouldRenderPreview,
  showBinaryPreview,
  showBinaryLoading,
  showBinaryError,
  binaryPreviewUrl,
  previewLabel,
  binaryPreviewType,
  binaryPreviewError,
  showFileCommentSection,
  fileCommentSectionProps,
  fileContent,
  currentFileId,
  initialLine,
  commentsByLine,
  onAddComment,
  revisionId,
  editorReadOnly
}) {
  return (
    <div ref={splitRef} style={viewerGrid}>
      <aside
        style={{
          ...viewerSidebar,
          width: `${sidebarWidth}px`,
          minWidth: '240px',
          maxWidth: '780px',
          flex: '0 0 auto'
        }}
      >
        <FileTree
          nodes={treeData}
          selectedPath={currentPath}
          expandedPaths={expandedPaths}
          onToggleDir={onToggleDir}
          onOpenFile={(filePath) => onOpenFile(filePath, 0)}
          commentCounts={fileCommentCounts}
          onCommentBadgeClick={onCommentBadgeClick}
          codeCommentCounts={codeCommentCounts}
          onCodeCommentBadgeClick={onCodeCommentBadgeClick}
        />
      </aside>

      <div
        role="separator"
        aria-orientation="vertical"
        tabIndex={-1}
        style={splitHandle}
        onMouseDown={(event) => {
          event.preventDefault();
          onStartDrag();
        }}
      />

      <div style={viewerContent}>
        <Breadcrumbs path={currentPath} onNavigate={onBreadcrumbNavigate} />
        {currentPath && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" style={linkButton} onClick={onOpenInNewTab}>
              Abrir en pestaña nueva
            </button>
          </div>
        )}
        {commentAnchors.length > 0 && (
          <div style={anchorBar}>
            Comentarios:
            {commentAnchors.map((comment) => (
              <button
                key={comment.id}
                type="button"
                style={anchorButton}
                onClick={() => onOpenCommentAnchor(comment.line)}
              >
                L{comment.line}
              </button>
            ))}
          </div>
        )}

        {fileLoading ? (
          <p>Cargando archivo...</p>
        ) : !currentPath ? (
          <p style={{ color: '#555' }}>Selecciona un archivo para revisarlo.</p>
        ) : shouldRenderPreview ? (
          <>
            {showBinaryPreview ? (
              <div style={previewWrapper}>
                <iframe
                  title={`Vista previa de ${previewLabel}`}
                  src={binaryPreviewUrl}
                  style={previewFrame}
                  sandbox={binaryPreviewType === 'html' ? 'allow-scripts' : undefined}
                />
              </div>
            ) : showBinaryLoading ? (
              <p>Cargando vista previa...</p>
            ) : showBinaryError ? (
              <div style={binaryWarning}>{binaryPreviewError}</div>
            ) : (
              <div style={binaryWarning}>No pudimos mostrar la vista previa de este archivo.</div>
            )}

            {showFileCommentSection && <ReviewFileCommentSection {...fileCommentSectionProps} />}
          </>
        ) : (
          <EditorPane
            path={currentPath}
            code={fileContent}
            height="560px"
            initialLine={initialLine}
            commentsByLine={commentsByLine}
            onAddComment={onAddComment}
            revisionId={revisionId}
            fileId={currentFileId}
            readOnly={editorReadOnly}
          />
        )}
      </div>
    </div>
  );
}
