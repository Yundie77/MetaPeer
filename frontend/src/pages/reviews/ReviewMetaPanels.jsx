import React from 'react';
import {
  errorStyle,
  inputStyle,
  labelStyle,
  linkPill,
  metaReviewFields,
  metaReviewPanel,
  miniMeta,
  statusActions,
  statusItem,
  statusList,
  successStyle,
  viewerHeader
} from './stylesReview.js';

export default function ReviewMetaPanels({
  showMetaReview,
  showStudentReviewSummary,
  metaReviewLoading,
  metaReviewError,
  metaReviewSuccess,
  reviewLoading,
  revisionId,
  reviewInfo,
  submissionMeta,
  submittedTime,
  metaReview,
  onMetaReviewNotaChange,
  onMetaReviewObservacionChange,
  metaReviewSaving,
  onSaveMetaReview,
  metaReviewInfo,
  metaSavedTime,
  reviewStatus
}) {
  return (
    <>
      {showMetaReview && (
        <section style={metaReviewPanel}>
          <div style={viewerHeader}>
            <strong>Meta-revisión</strong>
            {metaReviewLoading && <span style={miniMeta}>Cargando...</span>}
          </div>
          {metaReviewError && <p style={errorStyle}>{metaReviewError}</p>}
          {metaReviewSuccess && <p style={successStyle}>{metaReviewSuccess}</p>}
          {reviewLoading ? (
            <p style={miniMeta}>Cargando resumen de la revisión...</p>
          ) : (
            <ul style={statusList}>
              <li style={statusItem}>
                <div style={{ minWidth: '240px', flex: 1 }}>
                  <strong>Revisión #{revisionId}</strong>
                  <div style={miniMeta}>
                    Revisor: {reviewInfo?.equipo_revisor?.nombre || '—'}
                    {submissionMeta?.zipName ? ` · Entrega: ${submissionMeta.zipName}` : ''}
                  </div>
                  <div style={miniMeta} title={submittedTime.absoluteText || undefined}>
                    Enviada: {submittedTime.relativeText || reviewInfo?.fecha_envio || 'sin fecha'}
                    {reviewInfo?.nota_numerica !== null && reviewInfo?.nota_numerica !== undefined
                      ? ` · Nota: ${reviewInfo.nota_numerica}`
                      : ''}
                  </div>
                  {reviewInfo?.comentario && <div style={miniMeta}>Comentario: {reviewInfo.comentario}</div>}

                  <div style={metaReviewFields}>
                    <label style={labelStyle}>
                      Nota final
                      <small style={miniMeta}>0-10</small>
                      <input
                        style={inputStyle}
                        type="number"
                        step="0.5"
                        min="0"
                        max="10"
                        value={metaReview.nota}
                        onChange={(event) => onMetaReviewNotaChange(event.target.value)}
                        disabled={metaReviewSaving || metaReviewLoading}
                      />
                    </label>
                    <label style={labelStyle}>
                      Observación
                      <textarea
                        style={{ ...inputStyle, minHeight: '80px' }}
                        value={metaReview.observacion}
                        onChange={(event) => onMetaReviewObservacionChange(event.target.value)}
                        disabled={metaReviewSaving || metaReviewLoading}
                      />
                    </label>
                  </div>

                  {metaReviewInfo?.fecha_registro && (
                    <div style={miniMeta} title={metaSavedTime.absoluteText || undefined}>
                      Meta registrada {metaSavedTime.relativeText || metaReviewInfo.fecha_registro}
                    </div>
                  )}
                </div>
                <div style={statusActions}>
                  <span style={reviewStatus.style}>{reviewStatus.label}</span>
                  <button
                    type="button"
                    style={{
                      ...linkPill,
                      opacity: metaReviewSaving ? 0.6 : 1,
                      cursor: metaReviewSaving ? 'wait' : 'pointer'
                    }}
                    onClick={onSaveMetaReview}
                    disabled={metaReviewSaving}
                  >
                    {metaReviewSaving ? 'Guardando...' : 'Guardar meta-revisión'}
                  </button>
                </div>
              </li>
            </ul>
          )}
        </section>
      )}

      {showStudentReviewSummary && (
        <section style={metaReviewPanel}>
          <strong>Resumen de la revisión recibida</strong>
          {reviewLoading ? (
            <p style={miniMeta}>Cargando resumen de la revisión...</p>
          ) : (
            <ul style={statusList}>
              <li style={statusItem}>
                <div style={{ minWidth: '240px', flex: 1 }}>
                  <strong>Revisión #{revisionId}</strong>
                  <div style={miniMeta}>
                    Revisor: {reviewInfo?.equipo_revisor?.nombre || '—'}
                    {submissionMeta?.zipName ? ` · Entrega: ${submissionMeta.zipName}` : ''}
                  </div>
                  <div style={miniMeta} title={submittedTime.absoluteText || undefined}>
                    Enviada: {submittedTime.relativeText || reviewInfo?.fecha_envio || 'sin fecha'}
                  </div>
                  <div style={miniMeta}>
                    Nota: {reviewInfo?.nota_numerica !== null && reviewInfo?.nota_numerica !== undefined
                      ? reviewInfo.nota_numerica
                      : 'sin nota'}
                  </div>
                  <div style={miniMeta}>
                    Comentario: {reviewInfo?.comentario?.trim() || 'sin comentario'}
                  </div>
                </div>
                <div style={statusActions}>
                  <span style={reviewStatus.style}>{reviewStatus.label}</span>
                </div>
              </li>
            </ul>
          )}
        </section>
      )}
    </>
  );
}

