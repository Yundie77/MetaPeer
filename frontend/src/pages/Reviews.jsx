import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { getJson, postJson } from '../api.js';

export default function Reviews() {
  const { user, role } = useAuth();
  const isStudent = useMemo(() => role === 'ALUM', [role]);
  const isReviewer = useMemo(() => role === 'ADMIN' || role === 'PROF', [role]);

  return (
    <section>
      <h2>Revisiones</h2>
      {isStudent && <StudentReviews user={user} />}
      {isReviewer && <MetaReviews />}
      {!isStudent && !isReviewer && <p>No tienes permisos para ver esta sección.</p>}
    </section>
  );
}

function StudentReviews({ user }) {
  const [tasks, setTasks] = useState([]);
  const [selected, setSelected] = useState(null);
  const [rubric, setRubric] = useState([]);
  const [scores, setScores] = useState({});
  const [comment, setComment] = useState('');
  const [grade, setGrade] = useState('');
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [loadingRubric, setLoadingRubric] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const loadTasks = async () => {
      try {
        setLoadingTasks(true);
        setError('');
        const data = await getJson('/my-review-tasks');
        setTasks(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingTasks(false);
      }
    };
    loadTasks();
  }, []);

  const handleSelectTask = async (task) => {
    setSelected(task);
    setScores({});
    setComment(task.comentario || '');
    setGrade(task.nota_numerica || '');
    setSuccess('');
    try {
      setLoadingRubric(true);
      const items = await getJson(`/assignments/${task.assignmentId}/rubrica`);
      setRubric(items);
      if (task.respuestas) {
        setScores(task.respuestas);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingRubric(false);
    }
  };

  const handleScoreChange = (clave, value) => {
    setScores((prev) => ({
      ...prev,
      [clave]: value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selected) {
      setError('Selecciona una revisión primero.');
      return;
    }
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      await postJson('/reviews', {
        submissionId: selected.submissionId,
        reviewerUserId: user.id,
        respuestasJson: scores,
        comentario: comment,
        notaNumerica: grade ? Number(grade) : null
      });
      setSuccess('Revisión guardada correctamente.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={panelStyle}>
      <h3>Mis revisiones asignadas</h3>
      {error && <p style={errorStyle}>{error}</p>}
      {success && <p style={successStyle}>{success}</p>}
      {loadingTasks ? (
        <p>Cargando tareas de revisión...</p>
      ) : tasks.length === 0 ? (
        <p>No tienes revisiones pendientes.</p>
      ) : (
        <div style={reviewsLayout}>
          <ul style={taskListStyle}>
            {tasks.map((task) => (
              <li key={task.id}>
                <button
                  type="button"
                  style={taskButtonStyle(selected?.id === task.id)}
                  onClick={() => handleSelectTask(task)}
                >
                  {task.assignmentTitle} · {task.submissionZip}
                </button>
              </li>
            ))}
          </ul>
          {selected && (
            <form onSubmit={handleSubmit} style={reviewFormStyle}>
              <h4>
                Revisando: <span style={{ color: '#0b74de' }}>{selected.submissionZip}</span>
              </h4>
              {loadingRubric ? (
                <p>Cargando rúbrica...</p>
              ) : (
                rubric.map((item) => (
                  <div key={item.id} style={rubricFieldStyle}>
                    <label style={labelStyle}>
                      {item.texto}
                      <input
                        style={inputStyle}
                        type="number"
                        step="0.5"
                        value={scores[item.clave_item] ?? ''}
                        onChange={(event) => handleScoreChange(item.clave_item, event.target.value)}
                      />
                    </label>
                  </div>
                ))
              )}
              <label style={labelStyle}>
                Nota global
                <input
                  style={inputStyle}
                  type="number"
                  step="0.5"
                  value={grade}
                  onChange={(event) => setGrade(event.target.value)}
                />
              </label>
              <label style={labelStyle}>
                Comentario
                <textarea
                  style={{ ...inputStyle, minHeight: '80px' }}
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                />
              </label>
              <button type="submit" style={buttonStyle} disabled={saving}>
                {saving ? 'Guardando...' : 'Enviar revisión'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

function MetaReviews() {
  const [assignments, setAssignments] = useState([]);
  const [assignmentId, setAssignmentId] = useState('');
  const [mapData, setMapData] = useState([]);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [error, setError] = useState('');
  const [metaInputs, setMetaInputs] = useState({});
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const loadAssignments = async () => {
      try {
        setLoadingAssignments(true);
        const data = await getJson('/assignments');
        setAssignments(data);
        if (data.length > 0) {
          setAssignmentId(String(data[0].id));
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingAssignments(false);
      }
    };
    loadAssignments();
  }, []);

  useEffect(() => {
    if (!assignmentId) {
      setMapData([]);
      return;
    }

    const loadReviews = async () => {
      try {
        setLoadingReviews(true);
        setError('');
        setSuccess('');
        const map = await getJson(`/assignments/${assignmentId}/assignment-map`);
        const pairs = map.pairs || [];

        const reviewDetails = [];
        for (const pair of pairs) {
          for (const submissionId of pair.entregas) {
            const reviews = await getJson(`/reviews?submissionId=${submissionId}`);
            reviewDetails.push(...reviews);
          }
        }
        setMapData(reviewDetails);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingReviews(false);
      }
    };

    loadReviews();
  }, [assignmentId]);

  const handleMetaChange = (reviewId, field, value) => {
    setMetaInputs((prev) => ({
      ...prev,
      [reviewId]: {
        ...(prev[reviewId] || {}),
        [field]: value
      }
    }));
  };

  const handleSubmitMeta = async (reviewId) => {
    const payload = metaInputs[reviewId];
    if (!payload || (!payload.nota && !payload.observacion)) {
      setError('Ingrese al menos una nota u observación para la meta-revisión.');
      return;
    }
    try {
      await postJson(`/reviews/${reviewId}/meta`, {
        nota_calidad: payload.nota ? Number(payload.nota) : null,
        observacion: payload.observacion || ''
      });
      setSuccess('Meta-revisión guardada.');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ ...panelStyle, marginTop: '2rem' }}>
      <h3>Meta-evaluación</h3>
      <label style={labelStyle}>
        Tarea
        <select
          style={inputStyle}
          value={assignmentId}
          onChange={(event) => setAssignmentId(event.target.value)}
          disabled={loadingAssignments}
        >
          {assignments.map((assignment) => (
            <option key={assignment.id} value={assignment.id}>
              {assignment.titulo}
            </option>
          ))}
        </select>
      </label>

      {error && <p style={errorStyle}>{error}</p>}
      {success && <p style={successStyle}>{success}</p>}

      {loadingReviews ? (
        <p>Cargando revisiones...</p>
      ) : mapData.length === 0 ? (
        <p>No hay revisiones registradas para esta tarea.</p>
      ) : (
        <ul style={listStyle}>
          {mapData.map((review) => (
            <li key={review.id} style={metaCardStyle}>
              <div>
                <strong>Revisión #{review.id}</strong>
                <div style={metaInfoStyle}>
                  Nota enviada: {review.nota_numerica ?? 'sin nota'} · Guardada el{' '}
                  {review.fecha_envio || 'sin fecha'}
                </div>
              </div>
              <div>
                <label style={labelStyle}>
                  Nota de calidad
                  <input
                    style={inputStyle}
                    type="number"
                    step="0.5"
                    value={metaInputs[review.id]?.nota ?? ''}
                    onChange={(event) => handleMetaChange(review.id, 'nota', event.target.value)}
                  />
                </label>
                <label style={labelStyle}>
                  Observación
                  <textarea
                    style={{ ...inputStyle, minHeight: '70px' }}
                    value={metaInputs[review.id]?.observacion ?? ''}
                    onChange={(event) => handleMetaChange(review.id, 'observacion', event.target.value)}
                  />
                </label>
                <button type="button" style={buttonStyle} onClick={() => handleSubmitMeta(review.id)}>
                  Guardar meta-revisión
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const panelStyle = {
  border: '1px solid #dadada',
  borderRadius: '8px',
  padding: '1rem',
  background: '#fff'
};

const reviewsLayout = {
  display: 'flex',
  gap: '1rem',
  alignItems: 'flex-start'
};

const taskListStyle = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  width: '240px',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem'
};

const taskButtonStyle = (active) => ({
  width: '100%',
  padding: '0.6rem 0.75rem',
  borderRadius: '6px',
  border: active ? '2px solid #0b74de' : '1px solid #d0d0d0',
  background: active ? '#eaf2ff' : '#f8f8f8',
  cursor: 'pointer',
  textAlign: 'left'
});

const reviewFormStyle = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem'
};

const rubricFieldStyle = {
  display: 'flex',
  flexDirection: 'column'
};

const labelStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
  fontWeight: 600
};

const inputStyle = {
  padding: '0.5rem 0.65rem',
  borderRadius: '4px',
  border: '1px solid #ccc'
};

const buttonStyle = {
  padding: '0.6rem 0.9rem',
  background: '#0b74de',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  fontWeight: 600
};

const errorStyle = {
  color: 'crimson'
};

const successStyle = {
  color: '#1f7a1f'
};

const listStyle = {
  listStyle: 'none',
  padding: 0,
  margin: '1.5rem 0',
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem'
};

const metaCardStyle = {
  border: '1px solid #e0e0e0',
  borderRadius: '8px',
  padding: '1rem',
  background: '#fafafa',
  display: 'flex',
  gap: '1rem',
  justifyContent: 'space-between'
};

const metaInfoStyle = {
  fontSize: '0.85rem',
  color: '#666'
};
