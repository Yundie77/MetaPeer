const express = require('express');
const { requireAuth } = require('../../../auth');
const { db } = require('../../../db');
const { sendError, safeNumber } = require('../../helpers');

const router = express.Router();

router.get('/api/reviews/:reviewId/meta', requireAuth(['ADMIN', 'PROF']), (req, res) => {
  try {
    const reviewId = safeNumber(req.params.reviewId);
    if (!reviewId) {
      return sendError(res, 400, 'Identificador inválido.');
    }

    const revision = db.prepare('SELECT id FROM revision WHERE id = ?').get(reviewId);
    if (!revision) {
      return sendError(res, 404, 'La revisión no existe.');
    }

    const meta = db
      .prepare(
        `
        SELECT mr.id,
               mr.nota_calidad,
               mr.observacion,
               mr.fecha_registro,
               usr.nombre_completo AS profesor_nombre,
               usr.correo          AS profesor_correo
        FROM meta_revision mr
        LEFT JOIN usuario usr ON usr.id = mr.id_profesor
        WHERE mr.id_revision = ?
      `
      )
      .get(reviewId);

    return res.json({
      reviewId,
      meta: meta
        ? {
            id: meta.id,
            nota_calidad: meta.nota_calidad,
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

    const rawNota = req.body?.nota_calidad;
    const notaCalidad = rawNota === undefined || rawNota === null || rawNota === '' ? null : Number(rawNota);
    const observacion = (req.body?.observacion || '').trim();

    if (notaCalidad !== null) {
      if (!Number.isFinite(notaCalidad)) {
        return sendError(res, 400, 'La nota de calidad no es válida.');
      }
      if (notaCalidad < 0 || notaCalidad > 10) {
        return sendError(res, 400, 'La nota de calidad debe estar entre 0 y 10.');
      }
    }

    const existing = db.prepare('SELECT id FROM meta_revision WHERE id_revision = ?').get(reviewId);

    const registeredAt = new Date().toISOString();
    if (existing) {
      db.prepare(
        `
        UPDATE meta_revision
        SET nota_calidad = ?, observacion = ?, fecha_registro = ?
        WHERE id = ?
      `
      ).run(notaCalidad, observacion || null, registeredAt, existing.id);
    } else {
      db.prepare(
        `
        INSERT INTO meta_revision (id_tarea, id_entrega, id_revision, id_profesor, nota_calidad, observacion, fecha_registro)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        revision.assignment_id,
        revision.entrega_id,
        reviewId,
        req.user.id,
        notaCalidad,
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
