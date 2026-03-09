const { db } = require('../../db');

function ensureAssignmentExists(assignmentId) {
  return db
    .prepare(
      `
      SELECT t.id,
             t.id_asignatura,
             t.titulo,
             COALESCE(asg.revisores_por_entrega, 1) AS revisores_por_entrega
      FROM tarea t
      LEFT JOIN asignacion asg ON asg.id_tarea = t.id
      WHERE t.id = ?
    `
    )
    .get(assignmentId);
}

function ensureAssignmentRecord(assignmentId) {
  const existing = db.prepare('SELECT id FROM asignacion WHERE id_tarea = ?').get(assignmentId);
  if (existing) {
    return existing.id;
  }
  const result = db.prepare('INSERT INTO asignacion (id_tarea) VALUES (?)').run(assignmentId);
  return result.lastInsertRowid;
}

/**
 * Devuelve true cuando la asignacion ya esta bloqueada o ya tiene revisiones creadas.
 */
function isAssignmentStartedOrLocked(assignmentId) {
  const assignmentRecord = db.prepare('SELECT id, bloqueada FROM asignacion WHERE id_tarea = ?').get(assignmentId);
  if (!assignmentRecord) {
    return false;
  }

  const revisionsCount =
    db
      .prepare(
        `
      SELECT COUNT(*) AS total
      FROM revision
      WHERE id_asignacion = ?
    `
      )
      .get(assignmentRecord.id)?.total || 0;

  return Number(assignmentRecord.bloqueada) === 1 || Number(revisionsCount) > 0;
}

module.exports = {
  ensureAssignmentExists,
  ensureAssignmentRecord,
  isAssignmentStartedOrLocked
};
