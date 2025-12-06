const crypto = require('crypto');
const { db } = require('../db');
const { MAX_ASSIGNMENT_SHUFFLE, ROSTER_PREFIX } = require('./constants');

function sendError(res, status, message) {
  return res.status(status).json({ error: message });
}

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function ensureAssignmentExists(assignmentId) {
  return db
    .prepare(
      `
      SELECT id, id_asignatura, titulo, revisores_por_entrega
      FROM tarea
      WHERE id = ?
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

  ensureAssignmentRecord(insert.lastInsertRowid);
  return insert.lastInsertRowid;
}

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
      const found = selectTeam.get(assignmentId, team.nombre);
      const targetTeamId = found
        ? found.id
        : insertTeam.run(assignmentId, team.nombre || `Equipo ${team.id}`).lastInsertRowid;

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

function fetchSubmission(submissionId) {
  return db
    .prepare(
      `
      SELECT ent.id,
             ent.id_tarea       AS assignment_id,
             ent.id_equipo      AS team_id,
             ent.id_subidor     AS uploader_id,
             ent.nombre_zip     AS zip_name,
             ent.ruta_archivo   AS zip_path,
             ent.tamano_bytes   AS size_bytes,
             ent.fecha_subida   AS uploaded_at
      FROM entregas ent
      WHERE ent.id = ?
    `
    )
    .get(submissionId);
}

function userBelongsToTeam(teamId, userId) {
  return !!db
    .prepare(
      `
      SELECT 1
      FROM miembro_equipo
      WHERE id_equipo = ?
        AND id_usuario = ?
      LIMIT 1
    `
    )
    .get(teamId, userId);
}

function isReviewerOfSubmission(submissionId, userId) {
  return !!db
    .prepare(
      `
      SELECT 1
      FROM revision rev
      JOIN equipo eq ON eq.id = rev.id_revisores
      JOIN miembro_equipo me ON me.id_equipo = eq.id
      WHERE rev.id_entrega = ?
        AND me.id_usuario = ?
      LIMIT 1
    `
    )
    .get(submissionId, userId);
}

function ensureSubmissionAccess(submissionId, user, { allowReviewers = true } = {}) {
  const submission = fetchSubmission(submissionId);
  if (!submission) {
    return null;
  }

  if (user.rol === 'ADMIN' || user.rol === 'PROF') {
    return submission;
  }

  if (user.rol === 'ALUM') {
    if (userBelongsToTeam(submission.team_id, user.id)) {
      return submission;
    }
    if (allowReviewers && isReviewerOfSubmission(submissionId, user.id)) {
      return submission;
    }
  }

  return null;
}

function fetchRevisionContext(revisionId) {
  return db
    .prepare(
      `
      SELECT rev.id,
             rev.id_entrega     AS submission_id,
             rev.id_revisores   AS reviewer_team_id,
             ent.id_tarea       AS assignment_id,
             ent.id_equipo      AS author_team_id,
             ent.ruta_archivo   AS zip_path,
             ent.nombre_zip     AS zip_name
      FROM revision rev
      JOIN entregas ent ON ent.id = rev.id_entrega
      WHERE rev.id = ?
    `
    )
    .get(revisionId);
}

function ensureRevisionPermission(revisionId, user, { allowOwners = false } = {}) {
  const revision = fetchRevisionContext(revisionId);
  if (!revision) {
    return null;
  }

  if (user.rol === 'ADMIN' || user.rol === 'PROF') {
    return revision;
  }

  if (user.rol === 'ALUM') {
    if (userBelongsToTeam(revision.reviewer_team_id, user.id)) {
      return revision;
    }
    if (allowOwners && userBelongsToTeam(revision.author_team_id, user.id)) {
      return revision;
    }
  }

  return null;
}

function isLikelyBinary(buffer) {
  const sampleLength = Math.min(buffer.length, 8192);
  for (let i = 0; i < sampleLength; i += 1) {
    if (buffer[i] === 0) {
      return true;
    }
  }
  return false;
}

function shuffleArray(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

function buildDerangement(ids) {
  if (ids.length < 2) {
    return ids.slice();
  }

  for (let attempt = 0; attempt < MAX_ASSIGNMENT_SHUFFLE; attempt += 1) {
    const shuffled = shuffleArray(ids);
    const valid = ids.every((value, index) => value !== shuffled[index]);
    if (valid) {
      return shuffled;
    }
  }

  const rotated = ids.slice(1);
  rotated.push(ids[0]);
  return rotated;
}

function buildTeamAssignments(assignmentId) {
  const assignment = ensureAssignmentExists(assignmentId);
  if (!assignment) {
    throw new Error('La tarea no existe.');
  }

  const submissions = db
    .prepare(
      `
      SELECT e.id AS entrega_id,
             e.id_equipo AS equipo_autor_id,
             eq.nombre AS equipo_autor_nombre
      FROM entregas e
      JOIN equipo eq ON eq.id = e.id_equipo
      WHERE e.id_tarea = ?
      ORDER BY e.id
    `
    )
    .all(assignmentId);

  if (submissions.length < 2) {
    return { assignmentId, pairs: [] };
  }

  const teamOrder = Array.from(new Set(submissions.map((row) => row.equipo_autor_id)));
  if (teamOrder.length < 2) {
    return { assignmentId, pairs: [] };
  }

  const shuffledTeams = shuffleArray(teamOrder);
  const assignmentRecordId = ensureAssignmentRecord(assignmentId);

  const teamNameMap = new Map();
  submissions.forEach((row) => {
    teamNameMap.set(row.equipo_autor_id, row.equipo_autor_nombre);
  });

  const submissionByTeam = new Map();
  submissions.forEach((row) => {
    submissionByTeam.set(row.equipo_autor_id, row.entrega_id);
  });

  const insertRevision = db.prepare(
    `
    INSERT INTO revision (id_asignacion, id_entrega, id_revisores)
    VALUES (?, ?, ?)
    ON CONFLICT(id_entrega, id_revisores) DO UPDATE SET
      fecha_asignacion = datetime('now'),
      fecha_envio = NULL,
      respuestas_json = NULL,
      nota_numerica = NULL,
      comentario_extra = NULL
  `
  );

  const tx = db.transaction(() => {
    shuffledTeams.forEach((authorTeamId, index) => {
      const entregaId = submissionByTeam.get(authorTeamId);
      const reviewerTeamId = shuffledTeams[(index + 1) % shuffledTeams.length];
      insertRevision.run(assignmentRecordId, entregaId, reviewerTeamId);
    });
  });

  tx();

  const pairs = shuffledTeams.map((authorTeamId, index) => {
    const reviewerTeamId = shuffledTeams[(index + 1) % shuffledTeams.length];
    return {
      equipoAutor: {
        id: authorTeamId,
        nombre: teamNameMap.get(authorTeamId)
      },
      entregas: [submissionByTeam.get(authorTeamId)],
      revisores: [
        {
          id: reviewerTeamId,
          nombre: teamNameMap.get(reviewerTeamId),
          revisores: getTeamMembers(reviewerTeamId)
        }
      ]
    };
  });

  return {
    assignmentId,
    pairs
  };
}

function fetchAssignmentRubric(assignmentId) {
  const assignmentRecord = db.prepare('SELECT id FROM asignacion WHERE id_tarea = ?').get(assignmentId);
  if (!assignmentRecord) {
    return [];
  }

  return db
    .prepare(
      `
      SELECT id, clave_item, texto, peso, tipo, obligatorio, minimo, maximo, orden
      FROM rubrica_items
      WHERE id_asignacion = ?
      ORDER BY orden
    `
    )
    .all(assignmentRecord.id);
}

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

function formatGradesAsCsv(rows) {
  const header = 'email;autor_nombre;nota_entrega;bonus_review;nota_final';
  const lines = rows.map((row) =>
    [row.email || '', row.nombre || '', row.nota_entrega ?? '', row.bonus_review ?? '', row.nota_final ?? ''].join(';')
  );
  return [header, ...lines].join('\n');
}

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
  sendError,
  safeNumber,
  ensureAssignmentExists,
  ensureAssignmentRecord,
  ensureRosterAssignment,
  cloneRosterTeamsToAssignment,
  ensureUserTeam,
  getTeamMembers,
  fetchSubmission,
  userBelongsToTeam,
  isReviewerOfSubmission,
  ensureSubmissionAccess,
  fetchRevisionContext,
  ensureRevisionPermission,
  isLikelyBinary,
  shuffleArray,
  buildDerangement,
  buildTeamAssignments,
  fetchAssignmentRubric,
  fetchAssignmentMap,
  formatGradesAsCsv,
  getProfessorSubjects
};
