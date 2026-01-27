import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { getJson } from '../api.js';

const TYPE_LABELS = {
  assignment_assigned: 'Asignación',
  review_assigned: 'Revisión asignada',
  review_submitted: 'Revisión enviada',
  submissions_batch_uploaded: 'Carga de entregas',
  meta_review: 'Meta-revisión'
};

function formatDateTime(value) {
  if (!value) {
    return 'sin fecha';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString('es-ES', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function typeLabel(type) {
  return TYPE_LABELS[type] || type;
}

export default function Profile() {
  const { role } = useAuth();
  const isTeacher = useMemo(() => role === 'ADMIN' || role === 'PROF', [role]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payload, setPayload] = useState(null);

  useEffect(() => {
    if (!isTeacher) {
      setLoading(false);
      setPayload(null);
      return;
    }

    let cancelled = false;

    const loadProfile = async () => {
      try {
        setLoading(true);
        setError('');
        const data = await getJson('/profile');
        if (!cancelled) {
          setPayload(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setPayload(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [isTeacher]);

  if (!isTeacher) {
    return <p>Solo profesores y administradores pueden ver el perfil.</p>;
  }

  return (
    <section>
      <h2>Mi perfil</h2>
      <p style={introStyle}>Resumen de actividad reciente y eventos relevantes para tu perfil.</p>

      {error && <p style={errorStyle}>{error}</p>}

      {loading ? (
        <p>Cargando perfil...</p>
      ) : !payload ? (
        <p>No pudimos cargar el perfil.</p>
      ) : (
        <div style={layoutStyle}>
          <div style={columnStyle}>
            <div style={cardStyle}>
              <div style={profileHeaderStyle}>
                <div style={avatarStyle} aria-hidden="true">
                  👤
                </div>
                <div>
                  <div style={nameStyle}>{payload.profile?.nombre || 'Sin nombre'}</div>
                  <div style={metaTextStyle}>{payload.profile?.email || 'Sin correo'}</div>
                  <div style={roleBadgeStyle}>{payload.profile?.rol || 'SIN ROL'}</div>
                </div>
              </div>
            </div>

            <div style={cardStyle}>
              <h3 style={sectionTitleStyle}>Asignaturas</h3>
              {!payload.subjects || payload.subjects.length === 0 ? (
                <p style={emptyTextStyle}>No hay asignaturas asignadas.</p>
              ) : (
                <ul style={listStyle}>
                  {payload.subjects.map((subject) => (
                    <li key={subject.id} style={listItemStyle}>
                      {subject.nombre}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div style={cardStyle}>
              <h3 style={sectionTitleStyle}>Resumen</h3>
              <div style={statsGridStyle}>
                <div style={statBoxStyle}>
                  <div style={statLabelStyle}>Asignaciones</div>
                  <div style={statValueStyle}>{payload.stats?.assignmentsAssignedCount ?? 0}</div>
                </div>
                <div style={statBoxStyle}>
                  <div style={statLabelStyle}>Revisiones asignadas</div>
                  <div style={statValueStyle}>{payload.stats?.reviewsAssignedCount ?? 0}</div>
                </div>
                <div style={statBoxStyle}>
                  <div style={statLabelStyle}>Revisiones enviadas</div>
                  <div style={statValueStyle}>{payload.stats?.reviewsSubmittedCount ?? 0}</div>
                </div>
                <div style={statBoxStyle}>
                  <div style={statLabelStyle}>Meta-revisiones</div>
                  <div style={statValueStyle}>{payload.stats?.metaReviewsCount ?? 0}</div>
                </div>
                <div style={statBoxStyle}>
                  <div style={statLabelStyle}>Cargas ZIP</div>
                  <div style={statValueStyle}>{payload.stats?.batchesUploadedCount ?? 0}</div>
                </div>
              </div>
            </div>
          </div>

          <div style={timelineColumnStyle}>
            <div style={cardStyle}>
              <h3 style={sectionTitleStyle}>Actividad reciente</h3>
              {!payload.events || payload.events.length === 0 ? (
                <p style={emptyTextStyle}>Aún no hay eventos relevantes para mostrar.</p>
              ) : (
                <ul style={timelineListStyle}>
                  {payload.events.map((event) => (
                    <li key={event.id} style={timelineItemStyle}>
                      <div style={timelineHeaderStyle}>
                        <span style={timelineDateStyle}>{formatDateTime(event.timestamp)}</span>
                        <span style={timelineBadgeStyle}>{typeLabel(event.type)}</span>
                      </div>
                      <div style={timelineTitleStyle}>{event.title}</div>
                      {event.description && <div style={timelineDescriptionStyle}>{event.description}</div>}
                      <div style={timelineContextRowStyle}>
                        {event.assignmentTitle && (
                          <span style={contextChipStyle}>Tarea: {event.assignmentTitle}</span>
                        )}
                        {event.subjectName && <span style={contextChipStyle}>Asignatura: {event.subjectName}</span>}
                        {event.reviewId && <span style={contextChipStyle}>Revisión #{event.reviewId}</span>}
                        {event.submissionId && <span style={contextChipStyle}>Entrega #{event.submissionId}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

const introStyle = {
  color: '#555',
  fontSize: '0.95rem',
  marginTop: '-0.25rem'
};

const layoutStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(280px, 420px) minmax(0, 1fr)',
  gap: '1.25rem',
  alignItems: 'start'
};

const columnStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem'
};

const timelineColumnStyle = {
  minWidth: 0
};

const cardStyle = {
  border: '1px solid #e3e3e3',
  borderRadius: '10px',
  padding: '1rem',
  background: '#fff',
  boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
};

const profileHeaderStyle = {
  display: 'flex',
  gap: '0.9rem',
  alignItems: 'center'
};

const avatarStyle = {
  width: '56px',
  height: '56px',
  borderRadius: '12px',
  background: '#20232a',
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '1.6rem'
};

const nameStyle = {
  fontSize: '1.1rem',
  fontWeight: 700
};

const metaTextStyle = {
  fontSize: '0.9rem',
  color: '#666',
  marginTop: '0.15rem'
};

const roleBadgeStyle = {
  display: 'inline-block',
  marginTop: '0.4rem',
  padding: '0.2rem 0.5rem',
  borderRadius: '999px',
  background: '#eef3ff',
  color: '#1d3ea6',
  fontWeight: 700,
  fontSize: '0.75rem',
  textTransform: 'uppercase'
};

const sectionTitleStyle = {
  marginTop: 0,
  marginBottom: '0.6rem'
};

const listStyle = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.4rem'
};

const listItemStyle = {
  padding: '0.45rem 0.6rem',
  borderRadius: '6px',
  background: '#f7f7f7',
  border: '1px solid #ededed'
};

const emptyTextStyle = {
  margin: 0,
  color: '#666'
};

const statsGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '0.6rem'
};

const statBoxStyle = {
  border: '1px solid #ededed',
  borderRadius: '8px',
  padding: '0.6rem',
  background: '#fafafa'
};

const statLabelStyle = {
  fontSize: '0.8rem',
  color: '#666'
};

const statValueStyle = {
  fontSize: '1.4rem',
  fontWeight: 800,
  marginTop: '0.1rem'
};

const timelineListStyle = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.8rem'
};

const timelineItemStyle = {
  border: '1px solid #e9e9e9',
  borderRadius: '8px',
  padding: '0.8rem',
  background: '#fcfcfc',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem'
};

const timelineHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '0.5rem',
  flexWrap: 'wrap'
};

const timelineDateStyle = {
  fontSize: '0.85rem',
  color: '#555',
  fontWeight: 600
};

const timelineBadgeStyle = {
  fontSize: '0.72rem',
  fontWeight: 800,
  textTransform: 'uppercase',
  background: '#20232a',
  color: '#fff',
  padding: '0.2rem 0.45rem',
  borderRadius: '999px'
};

const timelineTitleStyle = {
  fontWeight: 800
};

const timelineDescriptionStyle = {
  color: '#333'
};

const timelineContextRowStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.35rem',
  marginTop: '0.15rem'
};

const contextChipStyle = {
  fontSize: '0.78rem',
  padding: '0.2rem 0.45rem',
  borderRadius: '6px',
  background: '#f1f3f5',
  border: '1px solid #e1e4e8',
  color: '#333'
};

const errorStyle = {
  color: 'crimson',
  fontWeight: 700
};

