const express = require('express');
const { requireAuth } = require('../../auth');
const { db } = require('../../db');
const {
  sendError,
  safeNumber,
  ensureAssignmentExists,
  formatGradesAsCsv
} = require('../helpers');
const { GRADE_WEIGHT_DELIVERY, GRADE_WEIGHT_REVIEW } = require('../constants');

const router = express.Router();

router.get('/api/export/grades', requireAuth(['ADMIN', 'PROF']), (req, res) => {
  try {
    const assignmentId = safeNumber(req.query.assignmentId);
    const format = (req.query.format || 'json').toLowerCase();

    if (!assignmentId) {
      return sendError(res, 400, 'Debes indicar assignmentId.');
    }

    const assignment = ensureAssignmentExists(assignmentId);
    if (!assignment) {
      return sendError(res, 404, 'La tarea no existe.');
    }

    const grades = db
      .prepare(
        `
        SELECT ent.id AS entrega_id,
               ent.id_subidor AS autor_id,
               usr.correo AS autor_email,
               usr.nombre_completo AS autor_nombre,
               AVG(rev.nota_numerica) AS promedio_nota
        FROM entregas ent
        LEFT JOIN usuario usr ON usr.id = ent.id_subidor
        LEFT JOIN revision rev ON rev.id_entrega = ent.id AND rev.fecha_envio IS NOT NULL AND rev.nota_numerica IS NOT NULL
        WHERE ent.id_tarea = ?
        GROUP BY ent.id
      `
      )
      .all(assignmentId);

    const bonusRows = db
      .prepare(
        `
        SELECT me.id_usuario AS user_id,
               AVG(meta.nota_calidad) AS bonus
        FROM meta_revision meta
        JOIN revision rev ON rev.id = meta.id_revision
        JOIN equipo eq ON eq.id = rev.id_revisores
        JOIN miembro_equipo me ON me.id_equipo = eq.id
        WHERE meta.id_tarea = ?
          AND meta.nota_calidad IS NOT NULL
        GROUP BY me.id_usuario
      `
      )
      .all(assignmentId);

    const bonusMap = new Map();
    bonusRows.forEach((row) => {
      bonusMap.set(row.user_id, Number(row.bonus));
    });

    const result = grades.map((row) => {
      const notaEntrega = row.promedio_nota !== null ? Number(row.promedio_nota.toFixed(2)) : null;
      const bonusReview = bonusMap.has(row.autor_id) ? Number(bonusMap.get(row.autor_id).toFixed(2)) : null;
      const bonusForFormula = bonusReview !== null ? bonusReview : 0;
      const finalScore =
        notaEntrega !== null
          ? Number((notaEntrega * GRADE_WEIGHT_DELIVERY + bonusForFormula * GRADE_WEIGHT_REVIEW).toFixed(2))
          : null;

      return {
        email: row.autor_email,
        nombre: row.autor_nombre,
        nota_entrega: notaEntrega,
        bonus_review: bonusReview,
        nota_final: finalScore
      };
    });

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="grades-assignment-${assignmentId}.csv"`);
      res.send(formatGradesAsCsv(result));
      return;
    }

    res.json({
      assignmentId,
      rows: result
    });
  } catch (error) {
    console.error('Error al exportar notas:', error);
    return sendError(res, 500, 'No pudimos exportar las notas.');
  }
});

module.exports = router;
