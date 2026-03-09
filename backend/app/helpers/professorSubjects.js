const { db } = require('../../db');

function getProfessorSubjects(professorId) {
  return db
    .prepare(
      `
      SELECT a.id, a.nombre
      FROM usuario_asignatura ua
      JOIN asignatura a ON a.id = ua.id_asignatura
      WHERE ua.id_usuario = ?
      ORDER BY a.nombre
    `
    )
    .all(professorId);
}

module.exports = {
  getProfessorSubjects
};
