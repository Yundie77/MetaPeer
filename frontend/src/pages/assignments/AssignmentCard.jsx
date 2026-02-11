import React from 'react';

export default function AssignmentCard({
  assignment,
  meta,
  fileInputRef,
  uploadingAssignmentId,
  onUpload,
  onTriggerUpload,
  onOpenRubric,
  onOpenExport,
  onOpenAssign,
  onReassign,
  onOpenSummary,
  styles,
  formatDateTime
}) { 
  const {cardStyle, metaStyle, descStyle, actionsStyle, smallButton, dangerButton} = styles;

  const blocked = assignment.asignacion_bloqueada || (assignment.asignacion_total_revisiones ?? 0) > 0;
  const hasZip = Boolean(meta?.hasZip);
  const hasTeams = Number(assignment.total_equipos) > 0;
  const canAssign = hasZip && !blocked;
  const uploadDisabled = uploadingAssignmentId === assignment.id || !hasTeams || blocked;
  const rubricDisabled = blocked;
  const assignButtonStyle = blocked
    ? dangerButton
    : {
        ...smallButton,
        opacity: canAssign ? 1 : 0.6,
        cursor: canAssign ? 'pointer' : 'not-allowed'
      };

  return (
    <li key={assignment.id} style={cardStyle}>
      <div>
        <strong>{assignment.titulo}</strong>
        <div style={metaStyle}>{assignment.fecha_entrega ? `Entrega: ${assignment.fecha_entrega}` : 'Sin fecha definida'}</div>
        {assignment.descripcion && <div style={descStyle}>{assignment.descripcion}</div>}
        {meta?.hasZip ? (
          <div style={{ ...metaStyle, display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <span>
              Última carga: {meta.uploadedAt ? formatDateTime(meta.uploadedAt) : 'sin fecha'}{' '}
              {meta.zipName ? `· ZIP: ${meta.zipName}` : ''}
            </span>
            <span>Entregas detectadas: {meta.total || '—'}</span>
          </div>
        ) : (
          <div style={metaStyle}>
            {hasTeams ? 'No hay entregas subidas aún.' : 'Contacte el admin para que importe equipos a la asignatura'}
          </div>
        )}
        {blocked ? (
          <div style={{ ...metaStyle, color: '#b45309' }}>
            Asignación guardada ({assignment.asignacion_modo || 'equipo'} ·{' '}
            {assignment.asignacion_revisores_por_entrega || assignment.revisores_por_entrega || 1} revisiones){' '}
            {assignment.asignacion_fecha_asignacion ? `· ${formatDateTime(assignment.asignacion_fecha_asignacion)}` : ''}
          </div>
        ) : null}
      </div>
      <div style={actionsStyle}>
        <input
          type="file"
          accept=".zip"
          style={{ display: 'none' }}
          ref={fileInputRef}
          onChange={(event) => onUpload(assignment.id, event.target.files?.[0] || null)}
        />
        <button
          type="button"
          style={{
            ...smallButton,
            opacity: uploadDisabled ? 0.6 : 1,
            cursor: uploadDisabled ? 'not-allowed' : 'pointer'
          }}
          onClick={() => onTriggerUpload(assignment.id)}
          disabled={uploadDisabled}
        >
          {uploadingAssignmentId === assignment.id ? 'Cargando...' : 'Subir entregas (ZIP)'}
        </button>
        <button
          type="button"
          style={{ ...smallButton, opacity: rubricDisabled ? 0.6 : 1, cursor: rubricDisabled ? 'not-allowed' : 'pointer' }}
          onClick={() => onOpenRubric(assignment)}
          disabled={rubricDisabled}
        >
          Rúbrica
        </button>
        {blocked && (
          <button type="button" style={smallButton} onClick={() => onOpenSummary(assignment)}>
            Resumen Asignación
          </button>
        )}
        <button
          type="button"
          style={assignButtonStyle}
          onClick={() => (blocked ? onReassign(assignment) : onOpenAssign(assignment))}
          disabled={!blocked && !canAssign}
        >
          {blocked ? 'Reasignar' : 'Asignación'}
        </button>
        <button type="button" style={smallButton} onClick={() => onOpenExport(assignment)}>
          Ver y exportar CSV
        </button>
      </div>
    </li>
  );
}
