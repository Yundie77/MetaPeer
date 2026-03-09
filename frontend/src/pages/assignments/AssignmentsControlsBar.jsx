import React from 'react';

export default function AssignmentsControlsBar({
  subjects,
  subjectId,
  loadingList,
  dueSortMode,
  dueSortTitle,
  onSubjectChange,
  onToggleDueSort,
  onOpenCreate,
  styles
}) {
  return (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap', margin: '1rem 0' }}>
      <label style={styles.labelStyle}>
        Asignatura
        <select
          style={styles.inputStyle}
          value={subjectId}
          onChange={(event) => onSubjectChange(event.target.value)}
          disabled={loadingList || subjects.length === 0}
        >
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.nombre}
            </option>
          ))}
        </select>
        <span style={styles.metaStyle}>Seleccione una asignatura para ver las tareas correspondientes.</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={styles.metaStyle}>Ordenar por Fecha de entrega</span>
          <button
            type="button"
            style={{ ...styles.smallButton, padding: '0.2rem 0.5rem', fontSize: '0.85rem' }}
            onClick={onToggleDueSort}
            title={dueSortTitle}
          >
            {dueSortMode === 'asc' ? '↑' : dueSortMode === 'desc' ? '↓' : '...'}
          </button>
        </div>
      </label>
      <button
        type="button"
        style={styles.buttonStyle}
        onClick={onOpenCreate}
        disabled={subjects.length === 0}
      >
        Crear tarea
      </button>
    </div>
  );
}

