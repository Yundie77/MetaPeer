import { useState } from 'react';
import { isAssignmentBlocked } from './assignmentUtils.js';

/**
 * Construye el estado derivado que se aplica tras confirmar una asignación.
 */
function buildAssignmentStatePatch(assignmentState, assignMode, requested) {
  return {
    asignacion_bloqueada: assignmentState?.bloqueada ?? 1,
    asignacion_modo: assignmentState?.modo || assignMode,
    asignacion_revisores_por_entrega: assignmentState?.revisores_por_entrega ?? requested,
    asignacion_fecha_asignacion: assignmentState?.fecha_asignacion
  };
}

export default function useAssignmentFlow({
  submissionsMeta,
  postJson,
  setAssignments,
  setError
}) {
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

  /**
   * Limpia el borrador de asignación sin cerrar el modal.
   */
  const resetAssignDraftState = ({ clearSeed = false } = {}) => {
    setAssignPreview(null);
    setAssignWarnings([]);
    setRubricWarningOpen(false);
    setAssignModalError('');
    if (clearSeed) {
      setAssignSeed('');
    }
    setAssignInfo('');
  };

  /**
   * Reinicia todo el estado del flujo y cierra el modal de asignación.
   */
  const resetAssignModalState = () => {
    setAssignModalOpen(false);
    setAssignTarget(null);
    setAssignModalLoading(false);
    setAssignConfirming(false);
    resetAssignDraftState();
  };

  /**
   * Valida y normaliza la cantidad de revisiones solicitadas.
   */
  const getValidRequestedReviews = () => {
    const requested = Math.floor(Number(assignReviews) || 0);
    if (!requested || requested < 1) {
      setAssignModalError('Indica cuántas revisiones hará cada revisor.');
      return null;
    }
    return requested;
  };

  /**
   * Verifica que exista una previsualización antes de confirmar.
   */
  const ensureAssignPreviewReady = () => {
    if (!assignPreview) {
      setAssignModalError('Primero genera una previsualización.');
      return false;
    }
    return true;
  };

  const handleAssignModeChange = (value) => {
    setAssignMode(value);
    resetAssignDraftState({ clearSeed: true });
  };

  const handleAssignReviewsChange = (value) => {
    setAssignReviews(value);
    resetAssignDraftState();
  };

  /**
   * Abre el modal de asignación aplicando validaciones de bloqueo y de ZIP cargado.
   */
  const openAssignModal = (assignment) => {
    if (!assignment?.id) return;
    const meta = submissionsMeta.get(assignment.id);
    if (!meta?.hasZip) {
      setError('Sube un ZIP de entregas antes de asignar revisiones.');
      return;
    }
    if (isAssignmentBlocked(assignment)) {
      setError('Esta tarea ya tiene una asignación confirmada. Consulta el mapa existente.');
      return;
    }
    setAssignTarget(assignment);
    setAssignMode(assignment.asignacion_modo || 'equipo');
    const defaultReviews = Number(assignment.asignacion_revisores_por_entrega || 1) || 1;
    setAssignReviews(defaultReviews);
    resetAssignDraftState({ clearSeed: true });
    setAssignModalOpen(true);
  };

  const closeAssignModal = () => {
    if (assignConfirming) {
      return;
    }
    resetAssignModalState();
  };

  /**
   * Solicita al backend una previsualización de asignaciones con semilla opcional.
   */
  const handlePreviewAssignment = async ({ freshSeed = false } = {}) => {
    if (!assignTarget) return;
    const requested = getValidRequestedReviews();
    if (requested === null) {
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
   * Abre el aviso previo de rúbrica cuando la previsualización ya es válida.
   */
  const handleOpenRubricWarning = () => {
    if (!assignTarget) return;
    if (assignModalLoading || assignConfirming) return;
    const requested = getValidRequestedReviews();
    if (requested === null) {
      return;
    }
    if (!ensureAssignPreviewReady()) {
      return;
    }
    setRubricWarningOpen(true);
  };

  /**
   * Confirma y persiste la asignación final, actualizando también el listado local.
   */
  const handleConfirmAssignment = async () => {
    if (!assignTarget) return;
    const requested = getValidRequestedReviews();
    if (requested === null) {
      return;
    }
    if (!ensureAssignPreviewReady()) {
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
        const assignmentPatch = buildAssignmentStatePatch(
          confirmed.assignmentState,
          assignMode,
          requested
        );
        setAssignments((prev) =>
          prev.map((item) => (item.id === assignTarget.id ? { ...item, ...assignmentPatch } : item))
        );
        setAssignTarget((prev) => (prev ? { ...prev, ...assignmentPatch } : prev));
      }
      closeAssignModal();
    } catch (err) {
      setAssignModalError(err.message);
    } finally {
      setAssignConfirming(false);
    }
  };

  const closeRubricWarning = () => {
    setRubricWarningOpen(false);
  };

  const openResetModal = (assignment) => {
    setResetTarget(assignment);
    setResetError('');
    setResetModalOpen(true);
  };

  const closeResetModal = () => {
    if (resetLoading) {
      return;
    }
    setResetModalOpen(false);
    setResetTarget(null);
    setResetError('');
  };

  /**
   * Resetea una asignación confirmada y vuelve a abrir el flujo normal de asignación.
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

  return {
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
  };
}
