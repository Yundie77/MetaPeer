const { db } = require('../db');
const {
  ROSTER_PREFIX,
  DEFAULT_RUBRIC_ITEM_KEY,
  DEFAULT_RUBRIC_ITEM_TEXT,
  DEFAULT_RUBRIC_ITEM_WEIGHT,
  RUBRIC_SCORE_MIN,
  RUBRIC_SCORE_MAX
} = require('./constants');
const { buildSeededRandom, shuffleArray, buildDerangement } = require('../utils/random');
const assignmentHelpers = require('./assignmentHelpers');

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

function ensureDefaultRubricForAssignment(assignmentId) {
  const assignmentRecordId = ensureAssignmentRecord(assignmentId);
  const existingCount = db
    .prepare(
      `
      SELECT COUNT(*) AS total
      FROM rubrica_items
      WHERE id_asignacion = ?
    `
    )
    .get(assignmentRecordId)?.total;

  if (Number(existingCount) > 0) {
    return assignmentRecordId;
  }

  db.prepare(
    `
    INSERT INTO rubrica_items (id_asignacion, clave_item, texto, peso)
    VALUES (?, ?, ?, ?)
  `
  ).run(
    assignmentRecordId,
    DEFAULT_RUBRIC_ITEM_KEY,
    DEFAULT_RUBRIC_ITEM_TEXT,
    DEFAULT_RUBRIC_ITEM_WEIGHT
  );

  return assignmentRecordId;
}

function fetchAssignmentRubric(assignmentId) {
  const assignmentRecordId = ensureDefaultRubricForAssignment(assignmentId);

  return db
    .prepare(
      `
      SELECT id, clave_item, texto, peso
      FROM rubrica_items
      WHERE id_asignacion = ?
      ORDER BY id ASC
    `
    )
    .all(assignmentRecordId);
}

function calculateRubricScore(rubricItems, rawResponses) {
  if (!Array.isArray(rubricItems) || rubricItems.length === 0) {
    throw new Error('La rúbrica no está configurada para esta tarea.');
  }

  if (!rawResponses || typeof rawResponses !== 'object' || Array.isArray(rawResponses)) {
    throw new Error('Las respuestas de la rúbrica no son válidas.');
  }

  const expectedKeys = new Set(rubricItems.map((item) => item.clave_item));
  const normalizedScores = {};

  for (const [key, rawValue] of Object.entries(rawResponses)) {
    if (!expectedKeys.has(key) && rawValue !== '' && rawValue !== null && rawValue !== undefined) {
      throw new Error(`La clave de rúbrica (${key}) no existe para esta tarea.`);
    }
  }

  let total = 0;
  rubricItems.forEach((item) => {
    const rawValue = rawResponses[item.clave_item];
    if (rawValue === '' || rawValue === null || rawValue === undefined) {
      throw new Error(`Falta la nota del criterio "${item.texto}".`);
    }

    const value = Number(rawValue);
    if (!Number.isFinite(value)) {
      throw new Error(`La nota del criterio "${item.texto}" no es válida.`);
    }
    if (value < RUBRIC_SCORE_MIN || value > RUBRIC_SCORE_MAX) {
      throw new Error(
        `La nota del criterio "${item.texto}" debe estar entre ${RUBRIC_SCORE_MIN} y ${RUBRIC_SCORE_MAX}.`
      );
    }

    const weight = Number(item.peso) || 0;
    normalizedScores[item.clave_item] = value;
    total += value * (weight / 100);
  });

  const notaFinal = Number(total.toFixed(2));
  return {
    normalizedScores,
    notaFinal
  };
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
  ensureDefaultRubricForAssignment,
  calculateRubricScore,
  shuffleArray,
  buildSeededRandom,
  buildDerangement,
  ...assignmentHelpers,
  fetchAssignmentRubric,
  fetchAssignmentMap,
  getProfessorSubjects
};
