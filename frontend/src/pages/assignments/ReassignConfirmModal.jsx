import React from 'react';

export default function ReassignConfirmModal({
  isOpen,
  assignment,
  loading,
  error,
  onCancel,
  onConfirm,
  styles
}) {
  if (!isOpen || !assignment) {
    return null;
  }

  const {
    modalOverlay,
    dangerModalContent,
    dangerHeader,
    dangerIcon,
    dangerBody,
    dangerListStyle,
    dangerActions,
    dangerButton,
    dangerCancelButton,
    errorStyle
  } = styles;

  return (
    <div
      style={modalOverlay}
      onClick={() => {
        if (!loading) {
          onCancel();
        }
      }}
    >
      <div style={dangerModalContent} onClick={(event) => event.stopPropagation()}>
        <div style={dangerHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={dangerIcon}>!</div>
            <div>
              <h3 style={{ margin: 0 }}>Reasignar revisiones</h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.9rem', opacity: 0.95 }}>{assignment.titulo}</p>
            </div>
          </div>
        </div>

        <div style={dangerBody}>
          <p style={{ marginTop: 0, textTransform: 'uppercase', fontWeight: 800 }}>
            Esta accion no se puede deshacer.
          </p>
          <p style={{ marginTop: 0 }}>
            Eliminaremos la asignacion actual y todas sus dependencias:
          </p>
          <ul style={dangerListStyle}>
            <li>Revisiones generadas</li>
            <li>Comentarios en lineas y notas</li>
            <li>Meta-revision y calificaciones asociadas</li>
          </ul>
          <p style={{ marginBottom: 0 }}>
            Los ZIPs y las entregas subidas no se borran.
          </p>
        </div>

        {error && <p style={errorStyle}>{error}</p>}

        <div style={dangerActions}>
          <button type="button" style={dangerCancelButton} onClick={onCancel} disabled={loading}>
            Cancelar
          </button>
          <button type="button" style={dangerButton} onClick={onConfirm} disabled={loading}>
            {loading ? 'Reasignando...' : 'Si, borrar y reasignar'}
          </button>
        </div>
      </div>
    </div>
  );
}
