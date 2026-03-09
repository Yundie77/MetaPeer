const { db } = require('../../db');
const { ROSTER_PREFIX } = require('../constants');

function ensureRosterAssignment(asignaturaId, creatorId) {
  const existing = db
    .prepare(
      `
      SELECT id FROM tarea
      WHERE id_asignatura = ?
        AND titulo LIKE ?
    `
    )
    .get(asignaturaId, `${ROSTER_PREFIX}%`);

  if (existing) {
    return existing.id;
  }

  const insert = db
    .prepare(
      `
      INSERT INTO tarea (id_asignatura, titulo, descripcion, estado, creado_por)
      VALUES (?, ?, ?, 'archivada', ?)
    `
    )
    .run(
      asignaturaId,
      `${ROSTER_PREFIX} Asignatura ${asignaturaId}`,
      'Tarea interna para administrar equipos importados.',
      creatorId
    );

  db.prepare('INSERT INTO asignacion (id_tarea) VALUES (?)').run(insert.lastInsertRowid);
  return insert.lastInsertRowid;
}

/**
 * Clona los equipos de roster de la asignatura hacia una tarea concreta, sin duplicar miembros.
 */
function cloneRosterTeamsToAssignment(asignaturaId, assignmentId) {
  const rosterAssignment = db
    .prepare(
      `
      SELECT id FROM tarea
      WHERE id_asignatura = ?
        AND titulo LIKE ?
    `
    )
    .get(asignaturaId, `${ROSTER_PREFIX}%`);

  if (!rosterAssignment) {
    return { equiposCopiados: 0, miembrosCopiados: 0 };
  }

  const rosterTeams = db.prepare('SELECT id, nombre FROM equipo WHERE id_tarea = ?').all(rosterAssignment.id);
  if (rosterTeams.length === 0) {
    return { equiposCopiados: 0, miembrosCopiados: 0 };
  }

  const selectTeam = db.prepare('SELECT id FROM equipo WHERE id_tarea = ? AND nombre = ?');
  const insertTeam = db.prepare('INSERT INTO equipo (id_tarea, nombre) VALUES (?, ?)');
  const selectMembers = db.prepare('SELECT id_usuario FROM miembro_equipo WHERE id_equipo = ?');
  const insertMember = db.prepare('INSERT OR IGNORE INTO miembro_equipo (id_equipo, id_usuario) VALUES (?, ?)');

  let equiposCopiados = 0;
  let miembrosCopiados = 0;

  const tx = db.transaction(() => {
    rosterTeams.forEach((team) => {
      const teamName = team.nombre || `Equipo ${team.id}`;
      const found = selectTeam.get(assignmentId, teamName);
      const targetTeamId = found ? found.id : insertTeam.run(assignmentId, teamName).lastInsertRowid;

      if (!found) {
        equiposCopiados += 1;
      }

      const members = selectMembers.all(team.id);
      members.forEach((member) => {
        const result = insertMember.run(targetTeamId, member.id_usuario);
        if (result.changes > 0) {
          miembrosCopiados += 1;
        }
      });
    });
  });

  tx();

  return { equiposCopiados, miembrosCopiados };
}

/**
 * Reemplaza completamente los equipos de una tarea por los del roster de su asignatura.
 */
function replaceAssignmentTeamsFromRoster(asignaturaId, assignmentId) {
  const rosterAssignment = db
    .prepare(
      `
      SELECT id FROM tarea
      WHERE id_asignatura = ?
        AND titulo LIKE ?
    `
    )
    .get(asignaturaId, `${ROSTER_PREFIX}%`);

  if (!rosterAssignment || rosterAssignment.id === assignmentId) {
    return { equiposCopiados: 0, miembrosCopiados: 0 };
  }

  const rosterTeams = db.prepare('SELECT id, nombre FROM equipo WHERE id_tarea = ?').all(rosterAssignment.id);
  const selectMembers = db.prepare('SELECT id_usuario FROM miembro_equipo WHERE id_equipo = ?');
  const deleteMembers = db.prepare(`
    DELETE FROM miembro_equipo
    WHERE id_equipo IN (
      SELECT id FROM equipo WHERE id_tarea = ?
    )
  `);
  const deleteTeams = db.prepare('DELETE FROM equipo WHERE id_tarea = ?');
  const insertTeam = db.prepare('INSERT INTO equipo (id_tarea, nombre) VALUES (?, ?)');
  const insertMember = db.prepare('INSERT OR IGNORE INTO miembro_equipo (id_equipo, id_usuario) VALUES (?, ?)');

  let equiposCopiados = 0;
  let miembrosCopiados = 0;

  const tx = db.transaction(() => {
    deleteMembers.run(assignmentId);
    deleteTeams.run(assignmentId);

    rosterTeams.forEach((team) => {
      const teamName = team.nombre || `Equipo ${team.id}`;
      const targetTeamId = insertTeam.run(assignmentId, teamName).lastInsertRowid;
      equiposCopiados += 1;

      const members = selectMembers.all(team.id);
      members.forEach((member) => {
        const result = insertMember.run(targetTeamId, member.id_usuario);
        if (result.changes > 0) {
          miembrosCopiados += 1;
        }
      });
    });
  });

  tx();

  return { equiposCopiados, miembrosCopiados };
}

function ensureUserTeam(assignmentId, userId) {
  const existing = db
    .prepare(
      `
      SELECT eq.id
      FROM equipo eq
      JOIN miembro_equipo me ON me.id_equipo = eq.id
      WHERE eq.id_tarea = ?
        AND me.id_usuario = ?
    `
    )
    .get(assignmentId, userId);

  if (existing) {
    return existing.id;
  }

  const teamName = `Equipo-${assignmentId}-${userId}`;
  const insertTeam = db.prepare('INSERT INTO equipo (id_tarea, nombre) VALUES (?, ?)').run(assignmentId, teamName);
  db.prepare('INSERT OR IGNORE INTO miembro_equipo (id_equipo, id_usuario) VALUES (?, ?)').run(
    insertTeam.lastInsertRowid,
    userId
  );

  return insertTeam.lastInsertRowid;
}

function getTeamMembers(teamId) {
  return db
    .prepare(
      `
      SELECT u.id, u.nombre_completo, u.correo
      FROM miembro_equipo me
      JOIN usuario u ON u.id = me.id_usuario
      WHERE me.id_equipo = ?
      ORDER BY u.nombre_completo
    `
    )
    .all(teamId);
}

module.exports = {
  ensureRosterAssignment,
  cloneRosterTeamsToAssignment,
  replaceAssignmentTeamsFromRoster,
  ensureUserTeam,
  getTeamMembers
};
