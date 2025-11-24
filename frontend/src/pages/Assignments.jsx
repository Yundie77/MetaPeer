import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { fetchJson, getJson, postJson } from '../api.js';

export default function Assignments() {
  const { role } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [subjectId, setSubjectId] = useState('');

  const [rubricTarget, setRubricTarget] = useState(null);
  const [rubricItems, setRubricItems] = useState([]);
  const [rubricSaving, setRubricSaving] = useState(false);
  const [rubricError, setRubricError] = useState('');

  const [assigning, setAssigning] = useState(false);
  const [assignSummary, setAssignSummary] = useState(null);

  const isTeacher = useMemo(() => role === 'ADMIN' || role === 'PROF', [role]);

  useEffect(() => {
    if (!isTeacher) {
      return;
    }

    const load = async () => {
      try {
        setLoadingList(true);
        setError('');
        const [assignmentsData, subjectsData] = await Promise.all([
          getJson('/assignments'),
          getJson('/asignaturas')
        ]);
        setAssignments(assignmentsData);
        setSubjects(subjectsData);
        if (subjectsData.length > 0) {
          setSubjectId(String(subjectsData[0].id));
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingList(false);
      }
    };

    load();
  }, [isTeacher]);

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!title.trim()) {
      setError('El título es obligatorio.');
      return;
    }
    if (!subjectId) {
      setError('Selecciona una asignatura.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      const created = await postJson('/assignments', {
        titulo: title.trim(),
        descripcion: description.trim(),
        fechaEntrega: dueDate || null,
        asignaturaId: Number(subjectId)
      });
      setAssignments((prev) => [created, ...prev]);
      setTitle('');
      setDescription('');
      setDueDate('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenRubric = async (assignment) => {
    try {
      setRubricTarget(assignment);
      setRubricItems([]);
      setRubricError('');
      const rows = await getJson(`/assignments/${assignment.id}/rubrica`);
      if (!rows || rows.length === 0) {
        setRubricItems([
          { clave: 'item_1', texto: 'Calidad general', peso: 1, tipo: 'numero' }
        ]);
      } else {
        setRubricItems(
          rows.map((row) => ({
            clave: row.clave_item,
            texto: row.texto,
            peso: row.peso,
            tipo: row.tipo
          }))
        );
      }
    } catch (err) {
      setRubricError(err.message);
    }
  };

  const handleAddRubricItem = () => {
    setRubricItems((prev) => [
      ...prev,
      {
        clave: `item_${prev.length + 1}`,
        texto: `Criterio ${prev.length + 1}`,
        peso: 1,
        tipo: 'numero'
      }
    ]);
  };

  const handleRubricChange = (index, field, value) => {
    setRubricItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const handleSaveRubric = async () => {
    if (!rubricTarget) {
      return;
    }
    try {
      setRubricSaving(true);
      setRubricError('');
      await postJson(`/assignments/${rubricTarget.id}/rubrica`, {
        items: rubricItems.map((item, index) => ({
          clave: item.clave || `item_${index + 1}`,
          texto: item.texto,
          peso: Number(item.peso) || 1,
          tipo: item.tipo || 'numero'
        }))
      });
      setRubricTarget(null);
      setRubricItems([]);
    } catch (err) {
      setRubricError(err.message);
    } finally {
      setRubricSaving(false);
    }
  };

  const handleAssignReviews = async (assignmentId) => {
    try {
      setAssigning(true);
      setAssignSummary(null);
      const result = await postJson(`/assignments/${assignmentId}/assign`, {});
      setAssignSummary(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setAssigning(false);
    }
  };

  const handleExport = async (assignmentId) => {
    try {
      const token = localStorage.getItem('metaPeerToken');
      const response = await fetch(`http://127.0.0.1:4000/api/export/grades?assignmentId=${assignmentId}&format=csv`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : ''
        }
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'No pudimos exportar.');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `grades-assignment-${assignmentId}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  };

  if (!isTeacher) {
    return <p>Solo administradores y profesores pueden gestionar asignaciones.</p>;
  }

  return (
    <section>
      <h2>Asignaciones</h2>
      <p style={{ color: '#555', fontSize: '0.9rem' }}>
        Crea tareas, define rúbricas y lanza la asignación automática de revisores.
      </p>

      <form onSubmit={handleCreate} style={formStyle}>
        <label style={labelStyle}>
          Asignatura
          <select
            style={inputStyle}
            value={subjectId}
            onChange={(event) => setSubjectId(event.target.value)}
            disabled={loadingList || saving || subjects.length === 0}
          >
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.nombre}
                </option>
              ))}
          </select>
        </label>
        <label style={labelStyle}>
          Título
          <input
            style={inputStyle}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={saving}
            placeholder="Ej: Proyecto 1"
          />
        </label>
        <label style={labelStyle}>
          Descripción (opcional)
          <textarea
            style={{ ...inputStyle, minHeight: '72px' }}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            disabled={saving}
            placeholder="Notas para el profesorado o el alumnado"
          />
        </label>
        <label style={labelStyle}>
          Fecha de entrega
          <input
            style={inputStyle}
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            disabled={saving}
          />
        </label>
        <button type="submit" style={buttonStyle} disabled={saving}>
          {saving ? 'Creando...' : 'Crear tarea'}
        </button>
      </form>

      {error && <p style={errorStyle}>{error}</p>}
      {loadingList ? (
        <p>Cargando tareas...</p>
      ) : assignments.length === 0 ? (
        <p>No hay asignaciones aún.</p>
      ) : (
        <ul style={listStyle}>
          {assignments.map((assignment) => (
            <li key={assignment.id} style={cardStyle}>
              <div>
                <strong>{assignment.titulo}</strong>
                <div style={metaStyle}>
                  {assignment.fecha_entrega ? `Entrega: ${assignment.fecha_entrega}` : 'Sin fecha definida'}
                </div>
                {assignment.descripcion && <div style={descStyle}>{assignment.descripcion}</div>}
              </div>
              <div style={actionsStyle}>
                <button type="button" style={smallButton} onClick={() => handleOpenRubric(assignment)}>
                  Rúbrica
                </button>
                <button
                  type="button"
                  style={smallButton}
                  onClick={() => handleAssignReviews(assignment.id)}
                  disabled={assigning}
                >
                  {assigning ? 'Asignando...' : 'Asignación'}
                </button>
                <button type="button" style={smallButton} onClick={() => handleExport(assignment.id)}>
                  Exportar CSV
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {assignSummary && (
        <div style={panelStyle}>
          <h3>Resultado de asignación</h3>
          {assignSummary.pairs.length === 0 ? (
            <p>No hay equipos suficientes para asignar revisiones.</p>
          ) : (
            <ul style={listStyle}>
              {assignSummary.pairs.map((pair) => (
                <li key={`${pair.equipoAutor.id}-${pair.equipoRevisor.id}`} style={miniCard}>
                  <p>
                    <strong>{pair.equipoAutor.nombre || `Equipo ${pair.equipoAutor.id}`}</strong> será revisado por{' '}
                    <strong>{pair.equipoRevisor.nombre || `Equipo ${pair.equipoRevisor.id}`}</strong>.
                  </p>
                  <p style={miniMeta}>
                    Revisores: {pair.revisores.length === 0 ? 'Sin miembros cargados' : pair.revisores.map((user) => user.nombre_completo).join(', ')}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {rubricTarget && (
        <div style={panelStyle}>
          <h3>Rúbrica para {rubricTarget.titulo}</h3>
          <p style={{ color: '#666', fontSize: '0.9rem' }}>
            Ajusta los criterios y pesos. Los alumnos verán estos campos al realizar la revisión.
          </p>
          {rubricItems.map((item, index) => (
            <div key={item.clave || index} style={rubricRowStyle}>
              <input
                style={{ ...inputStyle, flex: 1 }}
                value={item.texto}
                onChange={(event) => handleRubricChange(index, 'texto', event.target.value)}
              />
              <input
                style={rubricNumberStyle}
                type="number"
                min="0"
                step="0.1"
                value={item.peso}
                onChange={(event) => handleRubricChange(index, 'peso', event.target.value)}
              />
            </div>
          ))}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" style={smallButton} onClick={handleAddRubricItem} disabled={rubricSaving}>
              Añadir criterio
            </button>
            <button type="button" style={smallButton} onClick={handleSaveRubric} disabled={rubricSaving}>
              {rubricSaving ? 'Guardando...' : 'Guardar rúbrica'}
            </button>
            <button type="button" style={smallButton} onClick={() => setRubricTarget(null)} disabled={rubricSaving}>
              Cerrar
            </button>
          </div>
          {rubricError && <p style={errorStyle}>{rubricError}</p>}
        </div>
      )}
    </section>
  );
}

const formStyle = {
  display: 'grid',
  gap: '1rem',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  margin: '1.5rem 0'
};

const labelStyle = {
  display: 'flex',
  flexDirection: 'column',
  fontWeight: 600,
  gap: '0.35rem'
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
  color: 'crimson',
  marginBottom: '1rem'
};

const listStyle = {
  listStyle: 'none',
  padding: 0,
  margin: '1.5rem 0',
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem'
};

const cardStyle = {
  padding: '1rem',
  border: '1px solid #e0e0e0',
  borderRadius: '8px',
  background: '#fff',
  display: 'flex',
  justifyContent: 'space-between',
  gap: '1rem',
  alignItems: 'center'
};

const actionsStyle = {
  display: 'flex',
  gap: '0.5rem'
};

const smallButton = {
  background: '#f0f4ff',
  border: '1px solid #0b74de',
  color: '#0b74de',
  padding: '0.4rem 0.7rem',
  borderRadius: '4px',
  cursor: 'pointer',
  fontWeight: 600
};

const metaStyle = {
  fontSize: '0.85rem',
  color: '#666'
};

const descStyle = {
  marginTop: '0.35rem',
  fontSize: '0.9rem',
  color: '#444'
};

const panelStyle = {
  marginTop: '2rem',
  padding: '1rem',
  borderRadius: '8px',
  border: '1px solid #d0d0d0',
  background: '#fafafa'
};

const miniCard = {
  padding: '0.75rem',
  borderRadius: '6px',
  border: '1px solid #dcdcdc',
  background: '#fff'
};

const miniMeta = {
  fontSize: '0.85rem',
  color: '#555'
};

const rubricRowStyle = {
  display: 'flex',
  gap: '0.5rem',
  alignItems: 'center',
  marginBottom: '0.5rem'
};

const rubricNumberStyle = {
  width: '90px',
  padding: '0.45rem 0.6rem',
  borderRadius: '4px',
  border: '1px solid #ccc'
};
