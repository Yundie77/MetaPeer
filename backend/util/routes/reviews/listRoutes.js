const express = require('express');
const { requireAuth } = require('../../../auth');
const { db } = require('../../../db');
const { sendError, safeNumber, getTeamMembers } = require('../../helpers');

const router = express.Router();

router.get('/api/reviews', requireAuth(), (req, res) => {
  try {
    const submissionId = safeNumber(req.query.submissionId);
    if (!submissionId) {
      return sendError(res, 400, 'Debes indicar submissionId.');
    }

    const rows = db
      .prepare(
        `
        SELECT rev.id,
               rev.id_entrega,
               rev.id_revisores,
               rev.fecha_asignacion,
               rev.fecha_envio,
               rev.respuestas_json,
               rev.nota_numerica,
               rev.comentario_extra,
               eq.nombre AS equipo_revisor_nombre
        FROM revision rev
        JOIN equipo eq ON eq.id = rev.id_revisores
        WHERE rev.id_entrega = ?
        ORDER BY rev.fecha_asignacion DESC
      `
      )
      .all(submissionId);

    const formatted = rows.map((row) => ({
      id: row.id,
      id_entrega: row.id_entrega,
      equipo_revisor: {
        id: row.id_revisores,
        nombre: row.equipo_revisor_nombre,
        miembros: getTeamMembers(row.id_revisores)
      },
      fecha_asignacion: row.fecha_asignacion,
      fecha_envio: row.fecha_envio,
      respuestas: row.respuestas_json ? JSON.parse(row.respuestas_json) : null,
      nota_numerica: row.nota_numerica,
      comentario: row.comentario_extra
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Error al listar revisiones:', error);
    return sendError(res, 500, 'No pudimos obtener las revisiones.');
  }
});

module.exports = router;
