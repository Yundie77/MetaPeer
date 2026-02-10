const express = require('express');
const { requireAuth } = require('../../../auth');
const { db } = require('../../../db');
const { sendError, safeNumber, ensureRevisionPermission } = require('../../helpers');

const router = express.Router();

router.get('/api/reviews/:reviewId/meta', requireAuth(), (req, res) => {
  try {
    const reviewId = safeNumber(req.params.reviewId);
    if (!reviewId) {
      return sendError(res, 400, 'Identificador inválido.');
    }

    const revision = ensureRevisionPermission(reviewId, req.user);
    if (!revision) {
      const exists = db.prepare('SELECT id FROM revision WHERE id = ?').get(reviewId);
      if (!exists) {
        return sendError(res, 404, 'La revisión no existe.');
      }
      return sendError(res, 403, 'No puedes ver la meta-revisión de esta revisión.');
    }

    const meta = db
      .prepare(
        `
        SELECT mr.id,
               mr.nota_final,
               mr.observacion,
               mr.fecha_registro,
               usr.nombre_completo AS profesor_nombre,
               usr.correo          AS profesor_correo
        FROM meta_revision mr
        LEFT JOIN usuario usr ON usr.id = mr.id_profesor
        WHERE mr.id_revision = ?
      `
      )
      .get(revision.id);

    return res.json({
      reviewId,
      meta: meta
        ? {
            id: meta.id,
            nota_final: meta.nota_final,
            observacion: meta.observacion,
            fecha_registro: meta.fecha_registro,
            profesor: meta.profesor_nombre ? { nombre: meta.profesor_nombre, correo: meta.profesor_correo } : null
          }
        : null
    });
  } catch (error) {
    console.error('Error al consultar meta-revisión:', error);
    return sendError(res, 500, 'No pudimos obtener la meta-revisión.');
  }
});

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

    const rawNota = req.body?.nota_final ?? req.body?.nota_calidad;
    const notaFinal = rawNota === undefined || rawNota === null || rawNota === '' ? null : Number(rawNota);
    const observacion = (req.body?.observacion || '').trim();

    if (notaFinal !== null) {
      if (!Number.isFinite(notaFinal)) {
        return sendError(res, 400, 'La nota final no es válida.');
      }
      if (notaFinal < 0 || notaFinal > 10) {
        return sendError(res, 400, 'La nota final debe estar entre 0 y 10.');
      }
    }

    const existing = db.prepare('SELECT id FROM meta_revision WHERE id_revision = ?').get(reviewId);

    const registeredAt = new Date().toISOString();
    if (existing) {
      db.prepare(
        `
        UPDATE meta_revision
        SET nota_final = ?, observacion = ?, fecha_registro = ?
        WHERE id = ?
      `
      ).run(notaFinal, observacion || null, registeredAt, existing.id);
    } else {
      db.prepare(
        `
        INSERT INTO meta_revision (id_tarea, id_entrega, id_revision, id_profesor, nota_final, observacion, fecha_registro)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        revision.assignment_id,
        revision.entrega_id,
        reviewId,
        req.user.id,
        notaFinal,
        observacion || null,
        registeredAt
      );
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Error al registrar meta-revisión:', error);
    return sendError(res, 500, 'No pudimos registrar la meta-revisión.');
  }
});

module.exports = router;
