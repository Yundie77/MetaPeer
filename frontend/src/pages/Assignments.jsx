import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { fetchJson, getJson, postJson } from '../api.js';
import AssignModal from './assignments/AssignModal.jsx';
import ReassignConfirmModal from './assignments/ReassignConfirmModal.jsx';
import AssignmentSummaryModal from './assignments/AssignmentSummaryModal.jsx';
import RubricModal from './assignments/RubricModal.jsx';
import RubricWarningModal from './assignments/RubricWarningModal.jsx';
import CreateAssignmentModal from './assignments/CreateAssignmentModal.jsx';
import AssignmentCard from './assignments/AssignmentCard.jsx';
import * as styles from './assignments/styles.js';

/**
 * Pantalla de tareas para profes: alta de tareas, rúbricas, carga de ZIPs y asignación de revisiones.
 */
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
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createError, setCreateError] = useState('');
  const [dueSortMode, setDueSortMode] = useState('default');

  const [rubricTarget, setRubricTarget] = useState(null);
  const [rubricItems, setRubricItems] = useState([]);
  const [rubricSaving, setRubricSaving] = useState(false);
  const [rubricError, setRubricError] = useState('');

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState(null);
  const [assignMode, setAssignMode] = useState('equipo');
  const [assignReviews, setAssignReviews] = useState(1);
  const [assignPreview, setAssignPreview] = useState(null);
  const [assignWarnings, setAssignWarnings] = useState([]);
  const [assignModalError, setAssignModalError] = useState('');
  const [assignModalLoading, setAssignModalLoading] = useState(false);
  const [assignConfirming, setAssignConfirming] = useState(false);
  const [rubricWarningOpen, setRubricWarningOpen] = useState(false);
const [assignSeed, setAssignSeed] = useState('');
const [assignInfo, setAssignInfo] = useState('');
const [resetModalOpen, setResetModalOpen] = useState(false);
const [resetTarget, setResetTarget] = useState(null);
const [resetLoading, setResetLoading] = useState(false);
const [resetError, setResetError] = useState('');
const [summaryModalOpen, setSummaryModalOpen] = useState(false);
const [summaryTarget, setSummaryTarget] = useState(null);
const [summaryData, setSummaryData] = useState(null);
const [summaryLoading, setSummaryLoading] = useState(false);
const [summaryError, setSummaryError] = useState('');
const [summaryTab, setSummaryTab] = useState('map');
const [uploadingAssignmentId, setUploadingAssignmentId] = useState(null);
const [uploadMessage, setUploadMessage] = useState('');
const [submissionsMeta, setSubmissionsMeta] = useState(new Map());

  /**
   * Guarda metadatos de las entregas (ZIP, total, fecha) asociados a una tarea.
   */
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

  /**
   * Precarga metadatos de entregas cuando se cargan las tareas.
   */
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
// Se recalcula al cambiar "assignments" o "subjectId"
const filteredAssignments = useMemo(() => {
  if (!subjectId) return assignments;
  return assignments.filter((assignment) => String(assignment.id_asignatura) === String(subjectId));
}, [assignments, subjectId]);
const sortedAssignments = useMemo(() => {
  if (dueSortMode === 'default') {
    return filteredAssignments;
  }
  const direction = dueSortMode === 'asc' ? 1 : -1;
  const withFallback = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.getTime();
  };
  return [...filteredAssignments].sort((a, b) => {
    const aTime = withFallback(a.fecha_entrega);
    const bTime = withFallback(b.fecha_entrega);
    if (aTime === null && bTime === null) return 0;
    if (aTime === null) return 1;
    if (bTime === null) return -1;
    return (aTime - bTime) * direction;
  });
}, [filteredAssignments, dueSortMode]);
const selectedSubjectLabel = useMemo(() => {
  if (!subjectId) return '';
  const match = subjects.find((subject) => String(subject.id) === String(subjectId));
  return match?.nombre || '';
}, [subjects, subjectId]);

  /**
   * Carga inicial de tareas y asignaturas para profesores.
   */
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

  /**
   * Crea una nueva tarea desde el formulario.
   */
  const handleCreate = async (event) => {
    if (event?.preventDefault) {
      event.preventDefault();
    }
    if (!title.trim()) {
      setCreateError('El título es obligatorio.');
      return;
    }
    if (!subjectId) {
      setCreateError('Selecciona una asignatura.');
      return;
    }
    if (!dueDate) {
      setCreateError('Selecciona una fecha de entrega.');
      return;
    }

    try {
      setSaving(true);
      setCreateError('');
      const created = await postJson('/assignments', {
        titulo: title.trim(),
        descripcion: description.trim(),
        fechaEntrega: dueDate,
        asignaturaId: Number(subjectId)
      });
      setAssignments((prev) => [created, ...prev]);
      setTitle('');
      setDescription('');
      setDueDate('');
      setCreateModalOpen(false);
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setSaving(false);
    }
  };

  /**
   * Separa un texto de rúbrica en etiqueta y detalle.
   */
  const splitLabelDetail = (texto = '') => {
    const parts = texto.split('||DETAIL||');
    return {
      label: parts[0] || '',
      detail: parts.slice(1).join('||DETAIL||') || ''
    };
  };

  /**
   * Une etiqueta y detalle en el formato esperado por backend.
   */
  const combineLabelDetail = (label, detail) => {
    const safeLabel = label || '';
    const safeDetail = detail || '';
    return safeDetail ? `${safeLabel}||DETAIL||${safeDetail}` : safeLabel;
  };

  /**
   * Abre el modal de rúbrica y carga ítems existentes.
   */
  const handleOpenRubric = async (assignment) => {
    const blocked = assignment.asignacion_bloqueada || (assignment.asignacion_total_revisiones ?? 0) > 0;
    if (blocked) {
      setError('La asignación ya está iniciada/bloqueada. No se puede modificar la rúbrica.');
      return;
    }
    try {
      setRubricTarget(assignment);
      setRubricItems([]);
      setRubricError('');
      const rows = await getJson(`/assignments/${assignment.id}/rubrica`);
      if (!rows || rows.length === 0) {
        setRubricItems([
          { clave: 'item_1', texto: 'Calidad general', detalle: '', peso: 100 }
        ]);
      } else {
        setRubricItems(
          rows.map((row) => ({
            clave: row.clave_item,
            texto: splitLabelDetail(row.texto).label || row.texto,
            detalle: splitLabelDetail(row.texto).detail || '',
            peso: Number(row.peso) || 0
          }))
        );
      }
    } catch (err) {
      setRubricError(err.message);
    }
  };

  /**
   * Añade un criterio vacío a la rúbrica.
   */
  const handleAddRubricItem = () => {
    setRubricItems((prev) => [
      ...prev,
      {
        clave: `item_${prev.length + 1}`,
        texto: `Criterio ${prev.length + 1}`,
        detalle: '',
        peso: 1
      }
    ]);
  };

  /**
   * Actualiza un campo de un criterio de rúbrica.
   */
  const handleRubricChange = (index, field, value) => {
    setRubricItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  /**
   * Valida pesos y guarda la rúbrica en backend.
   */
  const handleSaveRubric = async () => {
    if (!rubricTarget) {
      return;
    }
    const hasZeroWeight = rubricItems.some((item) => Number(item.peso) <= 0);
    if (hasZeroWeight) {
      setRubricError('Cada criterio debe tener un porcentaje mayor a 0.');
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
          peso: Number(item.peso) || 0
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

  /**
   * Abre el selector de archivo para subir un ZIP de entregas.
   */
  const triggerUploadPicker = (assignmentId) => {
    setUploadMessage('');
    const assignment = assignments.find((item) => item.id === assignmentId);
    const blocked = assignment?.asignacion_bloqueada || (assignment?.asignacion_total_revisiones ?? 0) > 0;
    if (blocked) {
      setError('La asignación ya está iniciada/bloqueada. No se pueden subir entregas ZIP.');
      return;
    }
    const meta = submissionsMeta.get(assignmentId);
    if (meta?.hasZip) {
      const proceed = window.confirm(
        'Ya existe un ZIP subido. Si continúas, se eliminará la entrega anterior.'
      );
      if (!proceed) {
        return;
      }
    }
    const input = fileInputsRef.current[assignmentId];
    if (input) {
      input.value = '';
      input.click();
    }
  };

  /**
   * Sube un ZIP de entregas y actualiza metadatos de la tarea.
   */
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

  /**
   * Abre el modal de asignación si hay entregas y la tarea no está bloqueada.
   */
  const openAssignModal = (assignment) => {
    const meta = submissionsMeta.get(assignment.id);
    if (!meta?.hasZip) {
      setError('Sube un ZIP de entregas antes de asignar revisiones.');
      return;
    }
    const blocked = assignment.asignacion_bloqueada || (assignment.asignacion_total_revisiones ?? 0) > 0;
    if (blocked) {
      setError('Esta tarea ya tiene una asignación confirmada. Consulta el mapa existente.');
      return;
    }
    setAssignTarget(assignment);
    setAssignMode(assignment.asignacion_modo || 'equipo');
    const defaultReviews =
      Number(assignment.asignacion_revisores_por_entrega || assignment.revisores_por_entrega || 1) || 1;
    setAssignReviews(defaultReviews);
    setAssignPreview(null);
    setAssignWarnings([]);
    setAssignModalError('');
    setAssignSeed('');
    setAssignInfo('');
    setRubricWarningOpen(false);
    setAssignModalOpen(true);
  };

  /**
   * Abre el modal de confirmación para reasignar.
   */
  const openResetModal = (assignment) => {
    setResetTarget(assignment);
    setResetError('');
    setResetModalOpen(true);
  };

  /**
   * Cierra el modal de confirmación de reasignación.
   */
  const closeResetModal = () => {
    if (resetLoading) {
      return;
    }
    setResetModalOpen(false);
    setResetTarget(null);
    setResetError('');
  };

  /**
   * Resetea la asignación actual y abre el modal normal.
   */
  const handleResetAssignment = async () => {
    if (!resetTarget) return;
    try {
      setResetLoading(true);
      setResetError('');
      const response = await postJson(`/assignments/${resetTarget.id}/reset`);
      const updatedAssignment =
        response?.assignment || {
          ...resetTarget,
          asignacion_bloqueada: 0,
          asignacion_total_revisiones: 0,
          asignacion_fecha_asignacion: null
        };
      setAssignments((prev) =>
        prev.map((item) => (item.id === resetTarget.id ? { ...item, ...updatedAssignment } : item))
      );
      setResetModalOpen(false);
      setResetTarget(null);
      openAssignModal(updatedAssignment);
    } catch (err) {
      setResetError(err.message);
    } finally {
      setResetLoading(false);
    }
  };

  /**
   * Abre el modal de resumen y carga los datos desde backend.
   */
  const openSummaryModal = async (assignment) => {
    if (!assignment) return;
    setSummaryTarget(assignment);
    setSummaryTab('map');
    setSummaryError('');
    setSummaryData(null);
    setSummaryModalOpen(true);
    try {
      setSummaryLoading(true);
      const data = await getJson(`/assignments/${assignment.id}/assignment-summary`);
      setSummaryData(data);
    } catch (err) {
      setSummaryError(err.message);
    } finally {
      setSummaryLoading(false);
    }
  };

  /**
   * Navega a Export con la tarea seleccionada y autogenera ambos CSV.
   */
  const openExportForAssignment = useCallback((assignment) => {
    if (!assignment?.id) return;
    const params = new URLSearchParams({
      assignmentId: String(assignment.id),
      autogen: '1'
    });
    window.history.pushState({}, '', `/export?${params.toString()}`);
    window.dispatchEvent(new Event('popstate'));
  }, []);

  /**
   * Cierra el modal de resumen y limpia estados.
   */
  const closeSummaryModal = () => {
    setSummaryModalOpen(false);
    setSummaryTarget(null);
    setSummaryData(null);
    setSummaryError('');
    setSummaryLoading(false);
  };

  /**
   * Cierra el modal de asignación y limpia estados.
   */
  const closeAssignModal = () => {
    if (assignConfirming) {
      return;
    }
    setAssignModalOpen(false);
    setRubricWarningOpen(false);
    setAssignTarget(null);
    setAssignPreview(null);
    setAssignWarnings([]);
    setAssignModalError('');
    setAssignModalLoading(false);
    setAssignConfirming(false);
    setAssignInfo('');
  };

  /**
   * Pide al backend una previsualización de asignación (con semilla opcional).
   */
  const handlePreviewAssignment = async ({ freshSeed = false } = {}) => {
    if (!assignTarget) return;
    const requested = Math.floor(Number(assignReviews) || 0);
    if (!requested || requested < 1) {
      setAssignModalError('Indica cuántas revisiones hará cada revisor.');
      return;
    }
    try {
      setAssignModalLoading(true);
      setAssignModalError('');
      setAssignInfo('');
      const preview = await postJson(`/assignments/${assignTarget.id}/assign`, {
        modo: assignMode,
        revisionesPorRevisor: requested,
        seed: freshSeed ? null : assignSeed || null
      });
      setAssignPreview(preview);
      setAssignSeed(preview.seed || '');
      setAssignWarnings(preview.warnings || []);
    } catch (err) {
      setAssignModalError(err.message);
      setAssignPreview(null);
      setAssignWarnings([]);
    } finally {
      setAssignModalLoading(false);
    }
  };

  /**
   * Valida datos mínimos y abre el aviso previo a la confirmación real.
   */
  const handleOpenRubricWarning = () => {
    if (!assignTarget) return;
    if (assignModalLoading || assignConfirming) return;
    const requested = Math.floor(Number(assignReviews) || 0);
    if (!requested || requested < 1) {
      setAssignModalError('Indica cuántas revisiones hará cada revisor.');
      return;
    }
    if (!assignPreview) {
      setAssignModalError('Primero genera una previsualización.');
      return;
    }
    setRubricWarningOpen(true);
  };

  /**
   * Confirma y persiste la asignación usando la previsualización actual.
   */
  const handleConfirmAssignment = async () => {
    if (!assignTarget) return;
    const requested = Math.floor(Number(assignReviews) || 0);
    if (!requested || requested < 1) {
      setAssignModalError('Indica cuántas revisiones hará cada revisor.');
      return;
    }
    if (!assignPreview) {
      setAssignModalError('Primero genera una previsualización.');
      return;
    }
    try {
      setRubricWarningOpen(false);
      setAssignConfirming(true);
      setAssignModalError('');
      const confirmed = await postJson(`/assignments/${assignTarget.id}/assign`, {
        modo: assignMode,
        revisionesPorRevisor: requested,
        seed: assignPreview.seed || assignSeed || null,
        confirmar: true
      });
      setAssignPreview(confirmed);
      setAssignSeed(confirmed.seed || assignPreview.seed || '');
      setAssignWarnings(confirmed.warnings || []);
      setAssignInfo('Asignación guardada y bloqueada.');
      if (confirmed.assignmentState) {
        setAssignments((prev) =>
          prev.map((item) =>
            item.id === assignTarget.id
              ? {
                  ...item,
                  asignacion_bloqueada: confirmed.assignmentState.bloqueada ?? 1,
                  asignacion_modo: confirmed.assignmentState.modo || assignMode,
                  asignacion_revisores_por_entrega:
                    confirmed.assignmentState.revisores_por_entrega ?? requested,
                  asignacion_fecha_asignacion: confirmed.assignmentState.fecha_asignacion
                }
              : item
          )
        );
        setAssignTarget((prev) =>
          prev
            ? {
                ...prev,
                asignacion_bloqueada: confirmed.assignmentState.bloqueada ?? 1,
                asignacion_modo: confirmed.assignmentState.modo || assignMode,
                asignacion_revisores_por_entrega:
                  confirmed.assignmentState.revisores_por_entrega ?? requested,
                asignacion_fecha_asignacion: confirmed.assignmentState.fecha_asignacion
              }
            : prev
        );
      }
      closeAssignModal();
    } catch (err) {
      setAssignModalError(err.message);
    } finally {
      setAssignConfirming(false);
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

      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap', margin: '1rem 0' }}>
        <label style={styles.labelStyle}>
          Asignatura
          <select
            style={styles.inputStyle}
            value={subjectId}
            onChange={(event) => setSubjectId(event.target.value)}
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
              onClick={() =>
                setDueSortMode((prev) => (prev === 'default' ? 'asc' : prev === 'asc' ? 'desc' : 'default'))
              }
              title={
                dueSortMode === 'asc'
                  ? 'Orden ascendente por fecha de entrega'
                  : dueSortMode === 'desc'
                    ? 'Orden descendente por fecha de entrega'
                    : 'Orden original por id'
              }
            >
              {dueSortMode === 'asc' ? '↑' : dueSortMode === 'desc' ? '↓' : '...'}
            </button>
          </div>
        </label>
        <button
          type="button"
          style={styles.buttonStyle}
          onClick={() => {
            setCreateModalOpen(true);
            setCreateError('');
          }}
          disabled={subjects.length === 0}
        >
          Crear tarea
        </button>
      </div>

      {error && <p style={styles.errorStyle}>{error}</p>}
      {uploadMessage && <p style={styles.successStyle}>{uploadMessage}</p>}
      {loadingList ? (
        <p>Cargando tareas...</p>
      ) : sortedAssignments.length === 0 ? (
        <p>No hay asignaciones para esta asignatura.</p>
      ) : (
        <ul style={styles.listStyle}>
          {sortedAssignments.map((assignment) => (
            <AssignmentCard
              key={assignment.id}
              assignment={assignment}
              meta={submissionsMeta.get(assignment.id)}
              fileInputRef={(el) => {
                fileInputsRef.current[assignment.id] = el;
              }}
              uploadingAssignmentId={uploadingAssignmentId}
              onUpload={handleUploadZip}
              onTriggerUpload={triggerUploadPicker}
              onOpenRubric={handleOpenRubric}
              onOpenExport={openExportForAssignment}
              onOpenAssign={openAssignModal}
              onReassign={openResetModal}
              onOpenSummary={openSummaryModal}
              styles={styles}
              formatDateTime={formatDateTime}
            />
          ))}
        </ul>
      )}

      <CreateAssignmentModal
        isOpen={createModalOpen}
        subjectLabel={selectedSubjectLabel}
        title={title}
        description={description}
        dueDate={dueDate}
        saving={saving}
        error={createError}
        onClose={() => {
          setCreateModalOpen(false);
          setCreateError('');
        }}
        onSubmit={handleCreate}
        onTitleChange={setTitle}
        onDescriptionChange={setDescription}
        onDueDateChange={setDueDate}
        styles={styles}
      />

      <AssignmentSummaryModal
        isOpen={summaryModalOpen}
        assignment={summaryTarget}
        summary={summaryData}
        loading={summaryLoading}
        error={summaryError}
        activeTab={summaryTab}
        onTabChange={setSummaryTab}
        onClose={closeSummaryModal}
        styles={styles}
        formatDateTime={formatDateTime}
      />

      <ReassignConfirmModal
        isOpen={resetModalOpen && Boolean(resetTarget)}
        assignment={resetTarget}
        loading={resetLoading}
        error={resetError}
        onCancel={closeResetModal}
        onConfirm={handleResetAssignment}
        styles={styles}
      />

      <AssignModal
        isOpen={assignModalOpen && Boolean(assignTarget)}
        assignment={assignTarget}
        assignMode={assignMode}
        assignReviews={assignReviews}
        assignPreview={assignPreview}
        assignWarnings={assignWarnings}
        assignModalError={assignModalError}
        assignInfo={assignInfo}
        assignModalLoading={assignModalLoading}
        assignConfirming={assignConfirming}
        onClose={closeAssignModal}
        onPreview={() => handlePreviewAssignment()}
        onReassign={() => handlePreviewAssignment({ freshSeed: true })}
        onConfirm={handleOpenRubricWarning}
        onModeChange={(value) => {
          setAssignMode(value);
          setAssignPreview(null);
          setAssignWarnings([]);
          setRubricWarningOpen(false);
          setAssignSeed('');
          setAssignInfo('');
          setAssignModalError('');
        }}
        onReviewsChange={(value) => {
          setAssignReviews(value);
          setAssignPreview(null);
          setAssignWarnings([]);
          setRubricWarningOpen(false);
          setAssignInfo('');
          setAssignModalError('');
        }}
        styles={styles}
      />

      <RubricWarningModal
        isOpen={rubricWarningOpen}
        loading={assignConfirming}
        onBack={() => setRubricWarningOpen(false)}
        onConfirm={handleConfirmAssignment}
        styles={styles}
      />

      <RubricModal
        isOpen={Boolean(rubricTarget)}
        rubricTarget={rubricTarget}
        rubricItems={rubricItems}
        rubricSaving={rubricSaving}
        rubricError={rubricError}
        onClose={() => setRubricTarget(null)}
        onAddItem={handleAddRubricItem}
        onSave={handleSaveRubric}
        onChangeItem={handleRubricChange}
        onRemoveItem={(index) => setRubricItems((prev) => prev.filter((_, i) => i !== index))}
        styles={styles}
      />
    </section>
  );
}

/**
 * Formatea una fecha/hora a cadena legible en español.
 */
function formatDateTime(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString('es-ES');
  } catch (_error) {
    return value;
  }
}
