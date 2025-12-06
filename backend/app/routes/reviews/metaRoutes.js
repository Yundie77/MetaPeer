const express = require('express');
const { requireAuth } = require('../../../auth');
const { db } = require('../../../db');
const { sendError, safeNumber } = require('../../helpers');

const router = express.Router();

router.post('/api/reviews/:reviewId/meta', requireAuth(['ADMIN', 'PROF']), (req, res) => {
  try {
    const reviewId = safeNumber(req.params.reviewId);
    if (!reviewId) {
      return sendError(res, 400, 'Identificador inválido.');
    }

    const revision = db
      .prepare(
        `
        SELECT rev.id, ent.id_tarea AS assignment_id, ent.id AS entrega_id
        FROM revision rev
        JOIN entregas ent ON ent.id = rev.id_entrega
        WHERE rev.id = ?
      `
      )
      .get(reviewId);

    if (!revision) {
      return sendError(res, 404, 'La revisión no existe.');
    }

    const notaCalidad = req.body?.nota_calidad !== undefined ? Number(req.body.nota_calidad) : null;
    const observacion = (req.body?.observacion || '').trim();

    const existing = db.prepare('SELECT id FROM meta_revision WHERE id_revision = ?').get(reviewId);

    if (existing) {
      db.prepare(
        `
        UPDATE meta_revision
        SET nota_calidad = ?, observacion = ?, fecha_registro = datetime('now')
        WHERE id = ?
      `
      ).run(notaCalidad, observacion || null, existing.id);
    } else {
      db.prepare(
        `
        INSERT INTO meta_revision (id_tarea, id_entrega, id_revision, id_profesor, nota_calidad, observacion)
        VALUES (?, ?, ?, ?, ?, ?)
      `
      ).run(revision.assignment_id, revision.entrega_id, reviewId, req.user.id, notaCalidad, observacion || null);
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Error al registrar meta-revisión:', error);
    return sendError(res, 500, 'No pudimos registrar la meta-revisión.');
  }
});

module.exports = router;
