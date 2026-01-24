import React from 'react';
import AssignPreviewColumns from './AssignPreviewColumns.jsx';

export default function AssignModal({
  isOpen,
  assignment,
  assignMode,
  assignReviews,
  assignPreview,
  assignWarnings,
  assignModalError,
  assignInfo,
  assignModalLoading,
  assignConfirming,
  onClose,
  onPreview,
  onReassign,
  onConfirm,
  onModeChange,
  onReviewsChange,
  styles
}) {
  if (!isOpen || !assignment) {
    return null;
  }

  const {modalOverlay, modalContent, modalHeader, modalFormRow, labelStyle, inputStyle, smallButton, plainLinkButton, successStyle, errorStyle,
    warningListStyle, warningItemStyle, listStyle, metaStyle, miniCard, miniMeta, previewGrid, previewColumn, tagsRow, tag} = styles;

  return (
    <div style={modalOverlay} onClick={onClose}>
      <div style={modalContent} onClick={(event) => event.stopPropagation()}>
        <div style={modalHeader}>
          <div>
            <h3 style={{ margin: 0 }}>Asignar revisiones · {assignment.titulo}</h3>
            <p style={{ ...metaStyle, margin: '0.2rem 0 0' }}>
              Modo actual: {assignPreview?.mode || assignMode} · Revisiones por revisor:{' '}
              {assignPreview?.appliedReviewsPerReviewer || assignReviews}
              {assignPreview?.totalReviewers
                ? ` · Revisores: ${assignPreview.totalReviewers} · Entregas: ${assignPreview.totalSubmissions}`
                : ''}
            </p>
          </div>
          <button type="button" style={plainLinkButton} onClick={onClose}>
            Cerrar
          </button>
        </div>

        <div style={modalFormRow}>
          <label style={labelStyle}>
            Modo
            <select style={inputStyle} value={assignMode} onChange={(event) => onModeChange(event.target.value)}>
              <option value="equipo">Equipos</option>
              <option value="individual">Individual</option>
            </select>
          </label>
          <label style={labelStyle}>
            Revisiones por revisor
            <input
              style={inputStyle}
              type="number"
              min="1"
              value={assignReviews}
              onChange={(event) => onReviewsChange(event.target.value)}
            />
          </label>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
            <button
              type="button"
              style={smallButton}
              onClick={onPreview}
              disabled={assignModalLoading || assignConfirming || assignment?.asignacion_bloqueada}
            >
              {assignModalLoading ? 'Calculando...' : 'Previsualizar'}
            </button>
            <button
              type="button"
              style={smallButton}
              onClick={onReassign}
              disabled={assignModalLoading || assignConfirming || assignment?.asignacion_bloqueada}
            >
              Re-barajar
            </button>
            <button
              type="button"
              style={{ ...smallButton, background: '#0b74de', color: '#fff' }}
              onClick={onConfirm}
              disabled={!assignPreview || assignModalLoading || assignConfirming || assignment?.asignacion_bloqueada}
            >
              {assignConfirming ? 'Guardando...' : 'Confirmar'}
            </button>
          </div>
        </div>

        {assignInfo && <p style={successStyle}>{assignInfo}</p>}
        {assignModalError && <p style={errorStyle}>{assignModalError}</p>}
        {assignWarnings.length > 0 && (
          <ul style={warningListStyle}>
            {assignWarnings.map((warning, index) => (
              <li key={warning || index} style={warningItemStyle}>
                {warning}
              </li>
            ))}
          </ul>
        )}

        <AssignPreviewColumns
          assignPreview={assignPreview}
          listStyle={listStyle}
          metaStyle={metaStyle}
          miniCard={miniCard}
          miniMeta={miniMeta}
          previewGrid={previewGrid}
          previewColumn={previewColumn}
          tagsRow={tagsRow}
          tag={tag}
        />
      </div>
    </div>
  );
}
