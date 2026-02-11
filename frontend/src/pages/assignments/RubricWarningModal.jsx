import React from 'react';

export default function RubricWarningModal({ isOpen, loading, onBack, onConfirm, styles }) {
  if (!isOpen) {
    return null;
  }

  const { modalOverlay, modalContent, modalHeader, smallButton, metaStyle } = styles;

  const handleBack = () => {
    if (loading) return;
    onBack?.();
  };

  const handleConfirm = () => {
    if (loading) return;
    onConfirm?.();
  };

  return (
    <div style={modalOverlay}>
      <div style={{ ...modalContent, width: 'min(640px, 100%)' }} onClick={(event) => event.stopPropagation()}>
        <div style={modalHeader}>
          <h3 style={{ margin: 0 }}>Antes de confirmar</h3>
        </div>

        <p style={{ ...metaStyle, marginTop: '0.75rem', color: '#374151', lineHeight: 1.5 }}>
          Revisa que la rúbrica esté correcta (criterios y porcentajes). Al confirmar la asignación, se bloquearán
          cambios de rúbrica y subida de entregas ZIP.
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
          <button type="button" style={smallButton} onClick={handleBack} disabled={loading}>
            Volver
          </button>
          <button type="button" style={{ ...smallButton, background: '#0b74de', color: '#fff' }} onClick={handleConfirm} disabled={loading}>
            {loading ? 'Confirmando...' : 'Confirmar asignación'}
          </button>
        </div>
      </div>
    </div>
  );
}
