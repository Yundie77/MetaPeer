const express = require('express');
const { requireAuth } = require('../../auth');
const { db } = require('../../db');
const {
  sendError,
  safeNumber,
  ensureAssignmentExists,
  fetchAssignmentRubric
} = require('../helpers');

const router = express.Router();

function normalizeCell(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).replace(/\r?\n/g, ' ').trim();
}

function normalizeNumericCell(value) {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return '';
  }
  return String(Number(parsed.toFixed(2)));
}

router.get('/api/export/meta-outgoing', requireAuth(['ADMIN', 'PROF']), (req, res) => {
  try {
    const assignmentId = safeNumber(req.query.assignmentId);
    if (!assignmentId) {
      return sendError(res, 400, 'Debes indicar assignmentId.');
    }

    const assignment = ensureAssignmentExists(assignmentId);
    if (!assignment) {
      return sendError(res, 404, 'La tarea no existe.');
    }

    const rows = db
      .prepare(
        `
        SELECT usr.nombre_completo AS alumno_nombre,
               mr.id_revision      AS review_id,
               mr.nota_final       AS nota_meta_rev,
               mr.observacion      AS comentario
        FROM meta_revision mr
        JOIN revision rev ON rev.id = mr.id_revision
        JOIN equipo eq_revisor ON eq_revisor.id = rev.id_revisores
        JOIN miembro_equipo me_revisor ON me_revisor.id_equipo = eq_revisor.id
        JOIN usuario usr ON usr.id = me_revisor.id_usuario
        WHERE mr.id_tarea = ?
        ORDER BY usr.nombre_completo ASC, mr.id_revision ASC, usr.id ASC
      `
      )
      .all(assignmentId);

    const resultRows = rows.map((row) => ({
      alumno: normalizeCell(row.alumno_nombre),
      id_rev_saliente: row.review_id ?? '',
      nota_meta_rev: normalizeNumericCell(row.nota_meta_rev),
      comentario: normalizeCell(row.comentario)
    }));

    res.json({
      assignmentId,
      header: ['Alumno', 'id_rev_saliente', 'nota_meta_rev', 'comentario'],
      rows: resultRows
    });
  } catch (error) {
    console.error('Error al exportar meta-revisión saliente:', error);
    return sendError(res, 500, 'No pudimos exportar la meta-revisión saliente.');
  }
});

router.get('/api/export/incoming-reviews', requireAuth(['ADMIN', 'PROF']), (req, res) => {
  try {
    const assignmentId = safeNumber(req.query.assignmentId);
    if (!assignmentId) {
      return sendError(res, 400, 'Debes indicar assignmentId.');
    }

    const assignment = ensureAssignmentExists(assignmentId);
    if (!assignment) {
      return sendError(res, 404, 'La tarea no existe.');
    }

    const rubricItems = fetchAssignmentRubric(assignmentId);
    const criteriaHeader = rubricItems.map((_, index) => `nota_criterio_rubrica_${index + 1}`);

    const reviews = db
      .prepare(
        `
        SELECT usr.nombre_completo AS alumno_nombre,
               rev.id              AS review_id,
               rev.respuestas_json,
               rev.nota_numerica,
               rev.comentario_extra
        FROM revision rev
        JOIN entregas ent ON ent.id = rev.id_entrega
        JOIN equipo eq_autor ON eq_autor.id = ent.id_equipo
        JOIN miembro_equipo me_autor ON me_autor.id_equipo = eq_autor.id
        JOIN usuario usr ON usr.id = me_autor.id_usuario
        JOIN asignacion asg ON asg.id = rev.id_asignacion
        WHERE asg.id_tarea = ?
        ORDER BY usr.nombre_completo ASC, rev.id ASC, usr.id ASC
      `
      )
      .all(assignmentId);

    const resultRows = reviews.map((row) => {
      let respuestas = {};
      if (row.respuestas_json) {
        try {
          const parsed = JSON.parse(row.respuestas_json);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            respuestas = parsed;
          }
        } catch (_error) {
          respuestas = {};
        }
      }

      const criterios = rubricItems.map((item) => normalizeNumericCell(respuestas[item.clave_item]));

      return {
        alumno: normalizeCell(row.alumno_nombre),
        id_rev_entrante: row.review_id ?? '',
        criterios,
        nota_evaluada_rubrica: normalizeNumericCell(row.nota_numerica),
        comentario: normalizeCell(row.comentario_extra)
      };
    });

    res.json({
      assignmentId,
      header: ['Alumno', 'id_rev_entrante', ...criteriaHeader, 'nota_evaluada_rubrica', 'comentario'],
      rows: resultRows
    });
  } catch (error) {
    console.error('Error al exportar revisión entrante:', error);
    return sendError(res, 500, 'No pudimos exportar la revisión entrante.');
  }
});

module.exports = router;
