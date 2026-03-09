const { db } = require('../../db');
const { getTeamMembers } = require('./rosterTeams');

/**
 * Construye el mapa de asignacion: para cada equipo autor lista revisores y miembros.
 */
function fetchAssignmentMap(assignmentId) {
  const assignmentRecord = db.prepare('SELECT id FROM asignacion WHERE id_tarea = ?').get(assignmentId);
  if (!assignmentRecord) {
    return { assignmentId, pairs: [] };
  }

  const rows = db
    .prepare(
      `
      SELECT rev.id,
             rev.id_entrega,
             rev.id_revisores,
             ent.id_equipo AS equipo_autor_id,
             equipo_autor.nombre AS equipo_autor_nombre,
             equipo_revisor.nombre AS equipo_revisor_nombre
      FROM revision rev
      JOIN entregas ent ON ent.id = rev.id_entrega
      JOIN equipo equipo_autor ON equipo_autor.id = ent.id_equipo
      JOIN equipo equipo_revisor ON equipo_revisor.id = rev.id_revisores
      WHERE rev.id_asignacion = ?
      ORDER BY rev.id
    `
    )
    .all(assignmentRecord.id);

  const reviewerMembers = new Map();
  function cachedMembers(teamId) {
    if (!reviewerMembers.has(teamId)) {
      reviewerMembers.set(teamId, getTeamMembers(teamId));
    }
    return reviewerMembers.get(teamId);
  }

  const pairsMap = new Map();
  rows.forEach((row) => {
    if (!pairsMap.has(row.equipo_autor_id)) {
      pairsMap.set(row.equipo_autor_id, {
        equipoAutor: {
          id: row.equipo_autor_id,
          nombre: row.equipo_autor_nombre
        },
        entregas: [row.id_entrega],
        revisores: []
      });
    }

    pairsMap.get(row.equipo_autor_id).revisores.push({
      id: row.id_revisores,
      nombre: row.equipo_revisor_nombre,
      revisionId: row.id,
      revisores: cachedMembers(row.id_revisores)
    });
  });

  const pairs = Array.from(pairsMap.values());

  return {
    assignmentId,
    pairs
  };
}

module.exports = {
  fetchAssignmentMap
};
