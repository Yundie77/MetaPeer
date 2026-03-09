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
import AssignmentsControlsBar from './assignments/AssignmentsControlsBar.jsx';
import useAssignmentFlow from './assignments/useAssignmentFlow.js';
import {
  combineLabelDetail,
  getDueSortTitle,
  getNextDueSortMode,
  isAssignmentBlocked,
  sortAssignmentsByDue,
  splitLabelDetail
} from './assignments/assignmentUtils.js';
import * as styles from './assignments/stylesAssignment.js';

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

  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [summaryTarget, setSummaryTarget] = useState(null);
  const [summaryData, setSummaryData] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState('');
  const [summaryTab, setSummaryTab] = useState('map');

  const [uploadingAssignmentId, setUploadingAssignmentId] = useState(null);
  const [uploadMessage, setUploadMessage] = useState('');
  const [submissionsMeta, setSubmissionsMeta] = useState(new Map());

  const isTeacher = useMemo(() => role === 'ADMIN' || role === 'PROF', [role]);
  const fileInputsRef = useRef({});

  const dueSortTitle = getDueSortTitle(dueSortMode);

  const filteredAssignments = useMemo(() => {
    if (!subjectId) return assignments;
    return assignments.filter((assignment) => String(assignment.id_asignatura) === String(subjectId));
  }, [assignments, subjectId]);

  const sortedAssignments = useMemo(
    () => sortAssignmentsByDue(filteredAssignments, dueSortMode),
    [filteredAssignments, dueSortMode]
  );

  const selectedSubjectLabel = useMemo(() => {
    if (!subjectId) return '';
    const match = subjects.find((subject) => String(subject.id) === String(subjectId));
    return match?.nombre || '';
  }, [subjects, subjectId]);

  const {
    assignState: {
      assignModalOpen,
      assignTarget,
      assignMode,
      assignReviews,
      assignPreview,
      assignWarnings,
      assignModalError,
      assignInfo,
      assignModalLoading,
      assignConfirming,
      rubricWarningOpen,
      resetModalOpen,
      resetTarget,
      resetLoading,
      resetError
    },
    assignActions: {
      openAssignModal,
      closeAssignModal,
      handlePreviewAssignment,
      handleOpenRubricWarning,
      handleConfirmAssignment,
      handleAssignModeChange,
      handleAssignReviewsChange,
      closeRubricWarning,
      openResetModal,
      closeResetModal,
      handleResetAssignment
    }
  } = useAssignmentFlow({
    submissionsMeta,
    postJson,
    setAssignments,
    setError
  });

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
   * Abre el modal de rúbrica y carga ítems existentes.
   */
  const handleOpenRubric = async (assignment) => {
    if (isAssignmentBlocked(assignment)) {
      setError('La asignación ya está iniciada/bloqueada. No se puede modificar la rúbrica.');
      return;
    }
    try {
      setRubricTarget(assignment);
      setRubricItems([]);
      setRubricError('');
      const rows = await getJson(`/assignments/${assignment.id}/rubrica`);
      if (!rows || rows.length === 0) {
        setRubricItems([{ clave: 'item_1', texto: 'Calidad general', detalle: '', peso: 100 }]);
      } else {
        setRubricItems(
          rows.map((row) => {
            const parsed = splitLabelDetail(row.texto);
            return {
              clave: row.clave_item,
              texto: parsed.label || row.texto,
              detalle: parsed.detail || '',
              peso: Number(row.peso) || 0
            };
          })
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
    if (isAssignmentBlocked(assignment)) {
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

  const handleOpenCreateModal = () => {
    setCreateModalOpen(true);
    setCreateError('');
  };

  const toggleDueSortMode = () => {
    setDueSortMode((prev) => getNextDueSortMode(prev));
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

      <AssignmentsControlsBar
        subjects={subjects}
        subjectId={subjectId}
        loadingList={loadingList}
        dueSortMode={dueSortMode}
        dueSortTitle={dueSortTitle}
        onSubjectChange={setSubjectId}
        onToggleDueSort={toggleDueSortMode}
        onOpenCreate={handleOpenCreateModal}
        styles={styles}
      />

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
        onPreview={handlePreviewAssignment}
        onReassign={() => handlePreviewAssignment({ freshSeed: true })}
        onConfirm={handleOpenRubricWarning}
        onModeChange={handleAssignModeChange}
        onReviewsChange={handleAssignReviewsChange}
        styles={styles}
      />

      <RubricWarningModal
        isOpen={rubricWarningOpen}
        loading={assignConfirming}
        onBack={closeRubricWarning}
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
