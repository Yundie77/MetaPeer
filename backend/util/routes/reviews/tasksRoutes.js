const express = require('express');
const { requireAuth } = require('../../../auth');
const { db } = require('../../../db');
const { sendError } = require('../../helpers');

const router = express.Router();

router.get('/api/my-review-tasks', requireAuth(['ALUM']), (req, res) => {
  try {
    const rows = db
      .prepare(
        `
        SELECT DISTINCT
          rev.id,
          rev.id_entrega,
          rev.fecha_asignacion,
          rev.fecha_envio,
          rev.respuestas_json,
          rev.nota_numerica,
          rev.comentario_extra,
          ent.id_tarea AS assignment_id,
          tar.titulo AS assignment_title,
          ent.nombre_zip AS submission_zip,
          ent.fecha_subida AS submission_date
        FROM revision rev
        JOIN equipo eq ON eq.id = rev.id_revisores
        JOIN miembro_equipo me ON me.id_equipo = eq.id
        JOIN entregas ent ON ent.id = rev.id_entrega
        JOIN tarea tar ON tar.id = ent.id_tarea
        WHERE me.id_usuario = ?
        ORDER BY rev.fecha_asignacion DESC
      `
      )
      .all(req.user.id);

    const formatted = rows.map((row) => ({
      id: row.id,
      assignmentId: row.assignment_id,
      assignmentTitle: row.assignment_title,
      submissionId: row.id_entrega,
      submissionZip: row.submission_zip,
      assignedAt: row.fecha_asignacion,
      submittedAt: row.fecha_envio,
      nota_numerica: row.nota_numerica,
      comentario: row.comentario_extra,
      respuestas: row.respuestas_json ? JSON.parse(row.respuestas_json) : null
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Error al listar tareas de revisión:', error);
    return sendError(res, 500, 'No pudimos obtener tus revisiones.');
  }
});

module.exports = router;
