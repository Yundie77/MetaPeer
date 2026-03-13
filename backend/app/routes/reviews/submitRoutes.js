const express = require('express');
const { requireAuth } = require('../../../auth');
const { db } = require('../../../db');
const {
  sendError,
  safeNumber,
  escapeHtml,
  fetchAssignmentRubric,
  calculateRubricScore,
  logBusinessEvent
} = require('../../helpers');
const { RUBRIC_SCORE_MIN, RUBRIC_SCORE_MAX } = require('../../constants');

const router = express.Router();
const REVIEW_COMMENT_MAX_LENGTH = 5000;

function calculateCycleMs(assignedAt, submittedAt) {
  if (!assignedAt || !submittedAt) {
    return null;
  }
  const assignedMs = new Date(assignedAt).getTime();
  const submittedMs = new Date(submittedAt).getTime();
  if (!Number.isFinite(assignedMs) || !Number.isFinite(submittedMs)) {
    return null;
  }
  const diff = submittedMs - assignedMs;
  return diff >= 0 ? diff : null;
}

/**
 * Flujo: alumno envia revision completada -> backend valida rubrica y persiste respuestas/nota.
 */
router.post('/api/reviews', requireAuth(['ALUM']), (req, res) => {
  let submissionIdForLog = null;
  let assignmentIdForLog = null;
  let reviewIdForLog = null;

  try {
    const submissionId = safeNumber(req.body?.submissionId);
    submissionIdForLog = submissionId;
    const reviewerUserId = safeNumber(req.body?.reviewerUserId) || req.user.id;
    const respuestasJson = req.body?.respuestasJson || req.body?.respuestas || null;
    const comentarioRaw = req.body?.comentario ?? req.body?.comentarioExtra ?? '';
    const rawNota = req.body?.notaNumerica;
    const notaNumericaCliente =
      rawNota === undefined || rawNota === null || rawNota === '' ? null : Number(rawNota);

    if (comentarioRaw !== null && comentarioRaw !== undefined && typeof comentarioRaw !== 'string') {
      return sendError(res, 400, 'El comentario debe ser texto.');
    }

    const comentario = String(comentarioRaw).trim();
    if (comentario.length > REVIEW_COMMENT_MAX_LENGTH) {
      return sendError(res, 400, `El comentario no puede superar ${REVIEW_COMMENT_MAX_LENGTH} caracteres.`);
    }

    if (!submissionId) {
      return sendError(res, 400, 'Debes indicar submissionId.');
    }

    if (reviewerUserId !== req.user.id) {
      return sendError(res, 403, 'Solo puedes completar tus propias revisiones.');
    }

    if (notaNumericaCliente !== null) {
      if (!Number.isFinite(notaNumericaCliente)) {
        return sendError(res, 400, 'La nota numérica no es válida.');
      }
      if (notaNumericaCliente < RUBRIC_SCORE_MIN || notaNumericaCliente > RUBRIC_SCORE_MAX) {
        return sendError(
          res,
          400,
          `La nota numérica debe estar entre ${RUBRIC_SCORE_MIN} y ${RUBRIC_SCORE_MAX}.`
        );
      }
    }

    const revision = db
      .prepare(
        `
        SELECT rev.id, rev.fecha_asignacion, ent.id_tarea AS assignment_id
        FROM revision rev
        JOIN entregas ent ON ent.id = rev.id_entrega
        JOIN equipo eq ON eq.id = rev.id_revisores
        JOIN miembro_equipo me ON me.id_equipo = eq.id
        WHERE rev.id_entrega = ?
          AND me.id_usuario = ?
      `
      )
      .get(submissionId, req.user.id);

    if (!revision) {
      return sendError(res, 404, 'No tienes una revisión asignada para esta entrega.');
    }
    assignmentIdForLog = revision.assignment_id;
    reviewIdForLog = revision.id;

    let respuestasPayload = respuestasJson;
    if (typeof respuestasPayload === 'string') {
      try {
        respuestasPayload = JSON.parse(respuestasPayload);
      } catch (_error) {
        return sendError(res, 400, 'Las respuestas de la rúbrica no son válidas.');
      }
    }

    const rubricItems = fetchAssignmentRubric(revision.assignment_id);
    let rubricScore = null;
    try {
      rubricScore = calculateRubricScore(rubricItems, respuestasPayload);
    } catch (validationError) {
      return sendError(res, 400, validationError.message);
    }

    const submittedAt = new Date().toISOString();
    db.prepare(
      `
      UPDATE revision
      SET respuestas_json = ?,
          nota_numerica = ?,
          comentario_extra = ?,
          fecha_envio = ?,
          ultimo_revisor = ?
      WHERE id = ?
    `
    ).run(
      JSON.stringify(rubricScore.normalizedScores),
      rubricScore.notaFinal,
      comentario ? escapeHtml(comentario) : null,
      submittedAt,
      req.user.id,
      revision.id
    );

    const updated = db
      .prepare(
        `
        SELECT id, id_entrega, id_revisores, fecha_asignacion, fecha_envio, respuestas_json, nota_numerica, comentario_extra
        FROM revision
        WHERE id = ?
      `
      )
      .get(revision.id);
    const reviewCycleMs = calculateCycleMs(updated?.fecha_asignacion, updated?.fecha_envio);
    const reviewCycleHours =
      reviewCycleMs === null ? null : Number((reviewCycleMs / (1000 * 60 * 60)).toFixed(3));

    logBusinessEvent({
      event: 'review_submitted',
      action: 'submit_review',
      status: 'ok',
      user: req.user,
      assignmentId: revision.assignment_id,
      submissionId,
      reviewId: revision.id,
      data: {
        nota_numerica: updated?.nota_numerica ?? null,
        has_comment: Boolean(comentario),
        review_cycle_ms: reviewCycleMs,
        review_cycle_hours: reviewCycleHours
      }
    });

    logBusinessEvent({
      event: 'review_cycle_time_measured',
      action: 'measure_review_cycle_time',
      status: 'ok',
      user: req.user,
      assignmentId: revision.assignment_id,
      submissionId,
      reviewId: revision.id,
      data: {
        assigned_at: updated?.fecha_asignacion || null,
        submitted_at: updated?.fecha_envio || null,
        review_cycle_ms: reviewCycleMs,
        review_cycle_hours: reviewCycleHours
      }
    });

    res.json({
      id: updated.id,
      id_entrega: updated.id_entrega,
      id_revisores: updated.id_revisores,
      fecha_asignacion: updated.fecha_asignacion,
      fecha_envio: updated.fecha_envio,
      respuestas: updated.respuestas_json ? JSON.parse(updated.respuestas_json) : null,
      nota_numerica: updated.nota_numerica,
      comentario: updated.comentario_extra
    });
  } catch (error) {
    console.error('Error al guardar revisión:', error);
    logBusinessEvent({
      event: 'review_submitted',
      action: 'submit_review',
      status: 'error',
      user: req.user,
      assignmentId: assignmentIdForLog,
      submissionId: submissionIdForLog,
      reviewId: reviewIdForLog,
      data: {
        reason: 'unexpected_error'
      }
    });
    return sendError(res, 500, 'No pudimos guardar la revisión.');
  }
});

module.exports = router;
