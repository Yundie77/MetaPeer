import React from 'react';
import {
  errorStyle,
  fileCommentActions,
  fileCommentEmpty,
  fileCommentForm,
  fileCommentHeader,
  fileCommentInput,
  fileCommentItem,
  fileCommentList,
  fileCommentMessage,
  fileCommentMeta,
  fileCommentPanel,
  linkButton,
  miniMeta
} from './stylesReview.js';

export default function ReviewFileCommentSection({
  fileCommentsRef,
  fileCommentsLoading,
  fileCommentItems,
  fileCommentsError,
  fileCommentFormOpen,
  canCreateComments,
  fileCommentSaving,
  fileCommentDraft,
  onFileCommentDraftChange,
  onOpenFileCommentForm,
  onAddFileComment,
  hasFileComment
}) {
  return (
    <section ref={fileCommentsRef} style={fileCommentPanel}>
      <div style={fileCommentHeader}>
        <div>
          <strong>Comentario sobre el fichero</strong>
          <div style={miniMeta}>
            {fileCommentsLoading
              ? 'Cargando...'
              : `${fileCommentItems.length} comentario${fileCommentItems.length === 1 ? '' : 's'}`}
          </div>
        </div>
        <div style={fileCommentActions}>
          {canCreateComments && (
            <button
              type="button"
              style={linkButton}
              onClick={onOpenFileCommentForm}
              disabled={fileCommentSaving}
            >
              {hasFileComment ? 'Modificar comentario' : 'Añadir comentario'}
            </button>
          )}
        </div>
      </div>

      {fileCommentsError && <p style={errorStyle}>{fileCommentsError}</p>}

      {fileCommentFormOpen && canCreateComments && (
        <div style={fileCommentForm}>
          <textarea
            style={fileCommentInput}
            value={fileCommentDraft}
            onChange={(event) => onFileCommentDraftChange(event.target.value)}
            rows={2}
            placeholder="Escribe un comentario general sobre este archivo..."
            disabled={fileCommentSaving}
          />
          <button
            type="button"
            style={{
              ...linkButton,
              opacity: fileCommentSaving ? 0.6 : 1,
              cursor: fileCommentSaving ? 'wait' : 'pointer'
            }}
            onClick={onAddFileComment}
            disabled={fileCommentSaving}
          >
            {fileCommentSaving ? 'Guardando...' : 'Confirmar'}
          </button>
        </div>
      )}

      {fileCommentsLoading ? (
        <p>Cargando comentarios...</p>
      ) : fileCommentItems.length > 0 ? (
        <ul style={fileCommentList}>
          {fileCommentItems.map((item) => (
            <li key={item.id || item.message} style={fileCommentItem}>
              <div style={fileCommentMeta}>
                <span role="img" aria-hidden="true">💬</span>
                <span title={item.aliasTitle} style={{ fontWeight: 600, color: '#333' }}>
                  {item.alias}
                </span>
                {item.timeText && (
                  <span title={item.timeTitle}>{item.timeText}</span>
                )}
              </div>
              <div style={fileCommentMessage}>{item.message}</div>
            </li>
          ))}
        </ul>
      ) : (
        <p style={fileCommentEmpty}>Todavía no hay comentarios generales.</p>
      )}
    </section>
  );
}

