import React from 'react';

export default function AssignPreviewColumns({
  assignPreview, listStyle, metaStyle, miniCard, miniMeta, previewGrid, previewColumn, tagsRow, tag
}) {
  return (
    <div style={previewGrid}>
      <div style={previewColumn}>
        <h4>Quién revisa a quién</h4>
        {!assignPreview?.reviewers?.length ? (
          <p style={metaStyle}>Genera la previsualización para ver los emparejamientos.</p>
        ) : (
          <ul style={{ ...listStyle, margin: '0.75rem 0' }}>
            {assignPreview.reviewers.map((rev) => (
              <li key={`${rev.type}-${rev.id}`} style={miniCard}>
                <p style={{ margin: 0 }}>
                  <strong>{rev.name}</strong> {rev.teamName ? <span style={metaStyle}>({rev.teamName})</span> : null}
                </p>
                <p style={miniMeta}>
                  {rev.members?.length
                    ? `Miembros: ${rev.members.map((user) => user.nombre_completo || user.nombre).join(', ')}`
                    : 'Sin miembros asociados'}
                </p>
                {rev.targets?.length ? (
                  <div style={tagsRow}>
                    {rev.targets.map((target) => (
                      <span key={`${rev.id}-${target.teamId}`} style={tag}>
                        {target.teamName || `Equipo ${target.teamId}`}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p style={miniMeta}>Sin revisiones asignadas.</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div style={previewColumn}>
        <h4>Quién es revisado por quién</h4>
        {!assignPreview?.reviewed?.length ? (
          <p style={metaStyle}>Las entregas aparecerán aquí al calcular la asignación.</p>
        ) : (
          <ul style={{ ...listStyle, margin: '0.75rem 0' }}>
            {assignPreview.reviewed.map((item) => (
              <li key={item.teamId} style={miniCard}>
                <p style={{ margin: 0 }}>
                  <strong>{item.teamName || `Equipo ${item.teamId}`}</strong>
                </p>
                <p style={miniMeta}>
                  {item.members?.length
                    ? `Miembros: ${item.members.map((user) => user.nombre_completo || user.nombre).join(', ')}`
                    : 'Miembros no cargados'}
                </p>
                {item.reviewers?.length ? (
                  <div style={tagsRow}>
                    {item.reviewers.map((rev) => (
                      <span key={`${item.teamId}-${rev.type}-${rev.id}`} style={tag}>
                        {rev.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p style={miniMeta}>Sin revisores asignados.</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
