const express = require('express');
const { requireAuth } = require('../../../auth');
const { db } = require('../../../db');
const { sendError, safeNumber } = require('../../helpers');

const router = express.Router();

router.post('/api/reviews', requireAuth(['ALUM']), (req, res) => {
  try {
    const submissionId = safeNumber(req.body?.submissionId);
    const reviewerUserId = safeNumber(req.body?.reviewerUserId) || req.user.id;
    const respuestasJson = req.body?.respuestasJson || req.body?.respuestas || null;
    const comentario = (req.body?.comentario || req.body?.comentarioExtra || '').trim();
    const rawNota = req.body?.notaNumerica;
    const notaNumerica = rawNota === undefined || rawNota === null || rawNota === '' ? null : Number(rawNota);

    if (!submissionId) {
      return sendError(res, 400, 'Debes indicar submissionId.');
    }

    if (reviewerUserId !== req.user.id) {
      return sendError(res, 403, 'Solo puedes completar tus propias revisiones.');
    }

    if (notaNumerica !== null) {
      if (!Number.isFinite(notaNumerica)) {
        return sendError(res, 400, 'La nota numérica no es válida.');
      }
      if (notaNumerica < 0 || notaNumerica > 10) {
        return sendError(res, 400, 'La nota numérica debe estar entre 0 y 10.');
      }
    }

    const revision = db
      .prepare(
        `
        SELECT rev.id
        FROM revision rev
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

    let respuestasPayload = respuestasJson;
    if (typeof respuestasPayload === 'string') {
      try {
        respuestasPayload = JSON.parse(respuestasPayload);
      } catch (_error) {
        return sendError(res, 400, 'Las respuestas de la rúbrica no son válidas.');
      }
    }

    if (respuestasPayload && typeof respuestasPayload === 'object' && !Array.isArray(respuestasPayload)) {
      for (const [clave, value] of Object.entries(respuestasPayload)) {
        if (value === '' || value === null || value === undefined) continue;
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) {
          return sendError(res, 400, `La nota de la rúbrica (${clave}) no es válida.`);
        }
        if (parsed < 0 || parsed > 10) {
          return sendError(res, 400, `La nota de la rúbrica (${clave}) debe estar entre 0 y 10.`);
        }
      }
    }

    const submittedAt = new Date().toISOString();
    db.prepare(
      `
      UPDATE revision
      SET respuestas_json = ?, nota_numerica = ?, comentario_extra = ?, fecha_envio = ?
      WHERE id = ?
    `
    ).run(respuestasPayload ? JSON.stringify(respuestasPayload) : null, notaNumerica, comentario || null, submittedAt, revision.id);

    const updated = db
      .prepare(
        `
        SELECT id, id_entrega, id_revisores, fecha_asignacion, fecha_envio, respuestas_json, nota_numerica, comentario_extra
        FROM revision
        WHERE id = ?
      `
      )
      .get(revision.id);

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
    return sendError(res, 500, 'No pudimos guardar la revisión.');
  }
});

module.exports = router;
