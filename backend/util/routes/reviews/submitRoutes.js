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
    const notaNumerica = req.body?.notaNumerica !== undefined ? Number(req.body.notaNumerica) : null;

    if (!submissionId) {
      return sendError(res, 400, 'Debes indicar submissionId.');
    }

    if (reviewerUserId !== req.user.id) {
      return sendError(res, 403, 'Solo puedes completar tus propias revisiones.');
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

    db.prepare(
      `
      UPDATE revision
      SET respuestas_json = ?, nota_numerica = ?, comentario_extra = ?, fecha_envio = datetime('now')
      WHERE id = ?
    `
    ).run(respuestasJson ? JSON.stringify(respuestasJson) : null, notaNumerica, comentario || null, revision.id);

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
