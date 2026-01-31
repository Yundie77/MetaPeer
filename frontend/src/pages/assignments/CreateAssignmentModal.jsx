import React from 'react';

export default function CreateAssignmentModal({
  isOpen,
  subjectLabel,
  title,
  description,
  dueDate,
  saving,
  error,
  onClose,
  onSubmit,
  onTitleChange,
  onDescriptionChange,
  onDueDateChange,
  styles
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalContent} onClick={(event) => event.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div>
            <h3 style={{ margin: 0 }}>Crear tarea</h3>
            {subjectLabel ? (
              <p style={{ ...styles.metaStyle, margin: '0.2rem 0 0' }}>Asignatura: {subjectLabel}</p>
            ) : null}
          </div>
          <button type="button" style={styles.plainLinkButton} onClick={onClose} disabled={saving}>
            Cerrar
          </button>
        </div>

        <form onSubmit={onSubmit} style={{ ...styles.formStyle, marginTop: '1rem' }}>
          <label style={styles.labelStyle}>
            Título
            <input
              style={styles.inputStyle}
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              disabled={saving}
              placeholder="Ej: Proyecto 1"
            />
          </label>
          <label style={styles.labelStyle}>
            Descripción (opcional)
            <textarea
              style={{ ...styles.inputStyle, minHeight: '72px' }}
              value={description}
              onChange={(event) => onDescriptionChange(event.target.value)}
              disabled={saving}
              placeholder="Notas para el profesorado o el alumnado"
            />
          </label>
          <label style={styles.labelStyle}>
            Fecha de entrega
            <input
              style={styles.inputStyle}
              type="date"
              value={dueDate}
              onChange={(event) => onDueDateChange(event.target.value)}
              disabled={saving}
              required
            />
          </label>
          <button type="submit" style={styles.buttonStyle} disabled={saving}>
            {saving ? 'Creando...' : 'Crear tarea'}
          </button>
        </form>

        {error && <p style={styles.errorStyle}>{error}</p>}
      </div>
    </div>
  );
}
