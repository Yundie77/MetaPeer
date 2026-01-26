import React from 'react';

export default function RubricModal({
  isOpen,
  rubricTarget,
  rubricItems,
  rubricSaving,
  rubricError,
  onClose,
  onAddItem,
  onSave,
  onChangeItem,
  onRemoveItem,
  styles
}) {
  if (!isOpen || !rubricTarget) {
    return null;
  }

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalContent} onClick={(event) => event.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div>
            <h3>Rúbrica para {rubricTarget.titulo}</h3>
            <p style={{ ...styles.metaStyle, margin: '0.2rem 0 0' }}>
              Ajusta los criterios y pesos. Los alumnos verán estos campos al realizar la revisión.
            </p>
          </div>
          <button type="button" style={styles.plainLinkButton} onClick={onClose} disabled={rubricSaving}>
            Cerrar
          </button>
        </div>

        <div style={{ marginTop: '1rem' }}>
          {rubricItems.map((item, index) => (
            <div key={item.clave || index} style={styles.rubricRowStyle}>
              <input
                style={{ ...styles.inputStyle, flex: 1 }}
                value={item.texto}
                onChange={(event) => onChangeItem(index, 'texto', event.target.value)}
                disabled={rubricSaving}
              />
              <textarea
                style={{ ...styles.inputStyle, flex: 1, minHeight: '60px' }}
                placeholder="Notas en markdown (opcional)"
                value={item.detalle || ''}
                onChange={(event) => onChangeItem(index, 'detalle', event.target.value)}
                disabled={rubricSaving}
              />
              <input
                style={styles.rubricNumberStyle}
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={item.peso}
                onChange={(event) => onChangeItem(index, 'peso', event.target.value)}
                disabled={rubricSaving}
              />
              <span>%</span>
              <button
                type="button"
                style={{ ...styles.smallButton, background: '#ffecec', color: '#b91c1c', borderColor: '#b91c1c' }}
                onClick={() => onRemoveItem(index)}
                disabled={rubricSaving || index === 0}
                title={index === 0 ? 'El primer criterio no se puede eliminar' : 'Eliminar criterio'}
              >
                X
              </button>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
          <button type="button" style={styles.smallButton} onClick={onAddItem} disabled={rubricSaving}>
            Añadir criterio
          </button>
          <button type="button" style={styles.smallButton} onClick={onSave} disabled={rubricSaving}>
            {rubricSaving ? 'Guardando...' : 'Guardar rúbrica'}
          </button>
        </div>

        {rubricError && <p style={styles.errorStyle}>{rubricError}</p>}
      </div>
    </div>
  );
}
