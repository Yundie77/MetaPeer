import React, { useMemo } from 'react';
import AssignPreviewColumns from './AssignPreviewColumns.jsx';

export default function AssignmentSummaryModal({
  isOpen,
  assignment,
  summary,
  loading,
  error,
  activeTab,
  onTabChange,
  onClose,
  styles,
  formatDateTime
}) {
  if (!isOpen) {
    return null;
  }

  const tabs = useMemo(
    () => [
      { id: 'map', label: 'Mapa de revisión' },
      { id: 'stats', label: 'Fechas y números' },
      { id: 'status', label: 'Estado y enlaces' }
    ],
    []
  );

  const safeTab = tabs.some((tab) => tab.id === activeTab) ? activeTab : tabs[0].id;
  const assignmentInfo = summary?.assignment || assignment;
  const totals = summary?.totals || {};
  const mapData = summary?.map || {};
  const reviews = summary?.reviews || [];
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const formatValue = (value) => (value === null || value === undefined || value === '' ? '—' : value);
  const formatDate = (value) => (value ? formatDateTime(value) : '—');

  const resolveStatus = (review) => {
    if (!review?.submittedAt) {
      return { label: 'Pendiente', style: styles.statusBadgePending };
    }
    if (review.grade !== null && review.grade !== undefined) {
      return { label: 'Con nota', style: styles.statusBadgeGraded };
    }
    return { label: 'Enviada', style: styles.statusBadgeSubmitted };
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalContent} onClick={(event) => event.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div>
            <h3 style={{ margin: 0 }}>Resumen de asignación · {assignmentInfo?.titulo || '—'}</h3>
            <p style={{ ...styles.metaStyle, margin: '0.2rem 0 0' }}>
              Modo: {assignmentInfo?.asignacion_modo || 'equipo'} · Revisiones por entrega:{' '}
              {formatValue(assignmentInfo?.asignacion_revisores_por_entrega)}
            </p>
          </div>
          <button type="button" style={styles.plainLinkButton} onClick={onClose}>
            Cerrar
          </button>
        </div>

        <div style={styles.tabRow}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              style={safeTab === tab.id ? styles.tabButtonActive : styles.tabButton}
              onClick={() => onTabChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading && <p style={styles.metaStyle}>Cargando resumen...</p>}
        {error && <p style={styles.errorStyle}>{error}</p>}

        {!loading && safeTab === 'map' && (
          <>
            {!mapData?.reviewers?.length ? (
              <p style={styles.metaStyle}>No hay revisiones asignadas para esta tarea.</p>
            ) : (
              <AssignPreviewColumns
                assignPreview={mapData}
                listStyle={styles.listStyle}
                metaStyle={styles.metaStyle}
                miniCard={styles.miniCard}
                miniMeta={styles.miniMeta}
                previewGrid={styles.previewGrid}
                previewColumn={styles.previewColumn}
                tagsRow={styles.tagsRow}
                tag={styles.tag}
              />
            )}
          </>
        )}

        {!loading && safeTab === 'stats' && (
          <div style={styles.summaryGrid}>
            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>Fecha de asignación</div>
              <strong>{formatDate(assignmentInfo?.asignacion_fecha_asignacion)}</strong>
            </div>
            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>Modo</div>
              <strong>{assignmentInfo?.asignacion_modo || 'equipo'}</strong>
            </div>
            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>Revisiones por entrega</div>
              <strong>
                {formatValue(assignmentInfo?.asignacion_revisores_por_entrega)}
              </strong>
            </div>
            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>Total de revisiones</div>
              <strong>{formatValue(totals.totalReviews)}</strong>
            </div>
            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>Total de revisores</div>
              <strong>{formatValue(totals.totalReviewers)}</strong>
            </div>
            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>Total de entregas</div>
              <strong>{formatValue(totals.totalSubmissions)}</strong>
            </div>
          </div>
        )}

        {!loading && safeTab === 'status' && (
          <>
            {reviews.length === 0 ? (
              <p style={styles.metaStyle}>No hay revisiones registradas todavía.</p>
            ) : (
              <ul style={styles.statusList}>
                {reviews.map((review) => {
                  const status = resolveStatus(review);
                  const reviewUrl = `${origin}/reviews?revision=${review.revisionId}`;
                  return (
                    <li key={review.revisionId} style={styles.statusItem}>
                      <div>
                        <strong>Revisión #{review.revisionId}</strong>
                        <div style={styles.miniMeta}>
                          Revisor: {review.reviewerName || review.reviewerTeamName || '—'} · Entrega:{' '}
                          {review.authorTeamName || '—'}
                        </div>
                        <div style={styles.miniMeta}>
                          Asignada: {formatDate(review.assignedAt)} · Enviada: {formatDate(review.submittedAt)}
                          {review.grade !== null && review.grade !== undefined ? ` · Nota: ${review.grade}` : ''}
                        </div>
                        {review.comment ? (
                          <div style={styles.miniMeta}>Comentario: {review.comment}</div>
                        ) : null}
                      </div>
                      <div style={styles.statusActions}>
                        <span style={status.style}>{status.label}</span>
                        <a href={reviewUrl} style={styles.linkPill} target="_blank" rel="noreferrer">
                          Ver revisión
                        </a>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
