import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  const [uploadingAssignmentId, setUploadingAssignmentId] = useState(null);
  const [uploadMessage, setUploadMessage] = useState('');
  const [submissionsMeta, setSubmissionsMeta] = useState(new Map());

  const updateSubmissionsMeta = (assignmentId, meta) => {
    if (!assignmentId) return;
    setSubmissionsMeta((prev) => {
      const next = new Map(prev);
      next.set(assignmentId, {
        hasZip: Boolean(meta?.hasZip),
        total: Number(meta?.total) || 0,
        uploadedAt: meta?.uploadedAt || null,
        zipName: meta?.zipName || ''
      });
      return next;
    });
  };

  const preloadSubmissionsMeta = async (list = []) => {
    const entries = Array.isArray(list) ? list : [];
    for (const item of entries) {
      const assignmentId = item?.id;
      if (!assignmentId) continue;
      try {
        const data = await getJson(`/submissions?assignmentId=${assignmentId}`);
        const submissionsList = Array.isArray(data) ? data : data.submissions || [];
        const meta = data.meta?.ultimaCarga || data.meta?.ultima || null;
        const total = data.meta?.totalEntregas ?? submissionsList.length;
        updateSubmissionsMeta(assignmentId, {
          hasZip: Boolean(meta) || submissionsList.length > 0,
          total,
          uploadedAt: meta?.fecha_subida || meta?.fecha || null,
          zipName: meta?.nombre_zip || meta?.nombreZip || meta?.zipName || ''
        });
      } catch (_err) {
        // Si falla la carga de meta, dejamos el estado por defecto (sin ZIP)
      }
    }
  };

  const isTeacher = useMemo(() => role === 'ADMIN' || role === 'PROF', [role]);
  const fileInputsRef = useRef({});

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
        preloadSubmissionsMeta(assignmentsData);
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

  const splitLabelDetail = (texto = '') => {
    const parts = texto.split('||DETAIL||');
    return {
      label: parts[0] || '',
      detail: parts.slice(1).join('||DETAIL||') || ''
    };
  };

  const combineLabelDetail = (label, detail) => {
    const safeLabel = label || '';
    const safeDetail = detail || '';
    return safeDetail ? `${safeLabel}||DETAIL||${safeDetail}` : safeLabel;
  };

  const handleOpenRubric = async (assignment) => {
    try {
      setRubricTarget(assignment);
      setRubricItems([]);
      setRubricError('');
      const rows = await getJson(`/assignments/${assignment.id}/rubrica`);
      if (!rows || rows.length === 0) {
        setRubricItems([
          { clave: 'item_1', texto: 'Calidad general', detalle: '', peso: 100, tipo: 'numero' }
        ]);
      } else {
        setRubricItems(
          rows.map((row) => ({
            clave: row.clave_item,
            texto: splitLabelDetail(row.texto).label || row.texto,
            detalle: splitLabelDetail(row.texto).detail || '',
            peso: Number(row.peso) || 0,
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
        detalle: '',
        peso: 0,
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
    const total = rubricItems.reduce((acc, item) => acc + (Number(item.peso) || 0), 0);
    if (Math.abs(total - 100) > 0.001) {
      setRubricError('La suma de los pesos debe ser exactamente 100.');
      return;
    }
    try {
      setRubricSaving(true);
      setRubricError('');
      await postJson(`/assignments/${rubricTarget.id}/rubrica`, {
        items: rubricItems.map((item, index) => ({
          clave: item.clave || `item_${index + 1}`,
          texto: combineLabelDetail(item.texto, item.detalle),
          peso: Number(item.peso) || 0,
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

  const triggerUploadPicker = (assignmentId) => {
    setUploadMessage('');
    const input = fileInputsRef.current[assignmentId];
    if (input) {
      input.value = '';
      input.click();
    }
  };

  const handleUploadZip = async (assignmentId, file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setError('El archivo debe ser .zip.');
      return;
    }
    try {
      setUploadingAssignmentId(assignmentId);
      setError('');
      const formData = new FormData();
      formData.append('assignmentId', assignmentId);
      formData.append('zipFile', file);
      const result = await fetchJson('/submissions/upload-zip', {
        method: 'POST',
        body: formData
      });
      const target = assignments.find((item) => item.id === assignmentId);
    setUploadMessage(
      `Carga registrada para "${target?.titulo || 'la tarea'}": ${result.totalEquipos || 0} entregas encontradas.`
    );
      updateSubmissionsMeta(assignmentId, {
        hasZip: true,
        uploadedAt: result.fechaSubida || result.fecha || new Date().toISOString(),
        zipName: result.nombreZip || result.nombre_zip || file.name,
        total: Number(result.totalEquipos) || 0
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingAssignmentId(null);
      const input = fileInputsRef.current[assignmentId];
      if (input) {
        input.value = '';
      }
    }
  };

  const handleAssignReviews = async (assignmentId) => {
    const meta = submissionsMeta.get(assignmentId);
    if (!meta?.hasZip) {
      setError('Sube un ZIP de entregas antes de asignar revisiones.');
      return;
    }
    try {
      setAssigning(true);
      setAssignSummary(null);
      setError('');
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
      {uploadMessage && <p style={successStyle}>{uploadMessage}</p>}
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
                <AssignmentUploadsInfo meta={submissionsMeta.get(assignment.id)} />
              </div>
              <div style={actionsStyle}>
              <input
                type="file"
                accept=".zip"
                style={{ display: 'none' }}
                ref={(el) => {
                  fileInputsRef.current[assignment.id] = el;
                }}
                onChange={(event) => handleUploadZip(assignment.id, event.target.files?.[0] || null)}
              />
              <button
                type="button"
                style={smallButton}
                onClick={() => triggerUploadPicker(assignment.id)}
                disabled={uploadingAssignmentId === assignment.id}
              >
                {uploadingAssignmentId === assignment.id ? 'Cargando...' : 'Subir entregas (ZIP)'}
              </button>
              <button type="button" style={smallButton} onClick={() => handleOpenRubric(assignment)}>
                Rúbrica
              </button>
              <button
                type="button"
                  style={{
                    ...smallButton,
                    opacity: submissionsMeta.get(assignment.id)?.hasZip ? 1 : 0.6,
                    cursor: submissionsMeta.get(assignment.id)?.hasZip ? 'pointer' : 'not-allowed'
                  }}
                  onClick={() => handleAssignReviews(assignment.id)}
                  disabled={assigning || !submissionsMeta.get(assignment.id)?.hasZip}
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
            <p>Necesitas al menos dos equipos con entrega para repartir revisiones.</p>
          ) : (
            <ul style={listStyle}>
              {assignSummary.pairs.map((pair) => (
                <li key={pair.equipoAutor.id} style={miniCard}>
                  <p>
                    <strong>{pair.equipoAutor.nombre || `Equipo ${pair.equipoAutor.id}`}</strong> será revisado por{' '}
                    <strong>
                      {pair.revisores.length === 0
                        ? 'sin asignar'
                        : pair.revisores.map((rev) => rev.nombre || `Equipo ${rev.id}`).join(', ')}
                    </strong>.
                  </p>
                  {pair.revisores.map((rev) => (
                    <p key={rev.id} style={miniMeta}>
                      {rev.nombre || `Equipo ${rev.id}`} · Miembros:{' '}
                      {rev.revisores?.length
                        ? rev.revisores.map((user) => user.nombre_completo).join(', ')
                        : 'sin miembros cargados'}
                    </p>
                  ))}
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
              <textarea
                style={{ ...inputStyle, flex: 1, minHeight: '60px' }}
                placeholder="Notas en markdown (opcional)"
                value={item.detalle || ''}
                onChange={(event) => handleRubricChange(index, 'detalle', event.target.value)}
              />
              <input
                style={rubricNumberStyle}
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={item.peso}
                onChange={(event) => handleRubricChange(index, 'peso', event.target.value)}
              />
              <button
                type="button"
                style={{ ...smallButton, background: '#ffecec', color: '#b91c1c', borderColor: '#b91c1c' }}
                onClick={() => setRubricItems((prev) => prev.filter((_, i) => i !== index))}
                disabled={rubricSaving || index === 0}
                title={index === 0 ? 'El primer criterio no se puede eliminar' : 'Eliminar criterio'}
              >
                X
              </button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" style={smallButton} onClick={handleAddRubricItem} disabled={rubricSaving}>
              Añadir criterio
            </button>
            <button type="button" style={smallButton} onClick={handleSaveRubric} disabled={rubricSaving}>
              {rubricSaving ? 'Guardando...' : 'Guardar rúbrica'}
            </button>
            <button
              type="button"
              style={{ ...smallButton, background: '#ffecec', color: '#b91c1c', borderColor: '#b91c1c' }}
              onClick={() => setRubricTarget(null)}
              disabled={rubricSaving}
            >
              Cerrar
            </button>
          </div>
          {rubricError && <p style={errorStyle}>{rubricError}</p>}
        </div>
      )}
    </section>
  );
}

function AssignmentUploadsInfo({ meta }) {
  if (!meta?.hasZip) {
    return <div style={metaStyle}>No hay entregas subidas aún.</div>;
  }
  return (
    <div style={{ ...metaStyle, display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
      <span>
        Última carga: {meta.uploadedAt ? formatDateTime(meta.uploadedAt) : 'sin fecha'}{' '}
        {meta.zipName ? `· ZIP: ${meta.zipName}` : ''}
      </span>
      <span>Entregas detectadas: {meta.total || '—'}</span>
    </div>
  );
}

function formatDateTime(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString('es-ES');
  } catch (_error) {
    return value;
  }
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
  padding: '0.6rem 0.3rem',
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

const successStyle = {
  color: '#0f7b0f',
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
  gap: '0.5rem',
  alignItems: 'flex-end',
  flexWrap: 'wrap'
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
