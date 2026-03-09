const { db } = require('../../db');

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

/**
 * Valida si un usuario puede acceder a una entrega y devuelve su contexto cuando procede.
 */
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

/**
 * Valida si un usuario puede operar sobre una revision concreta y devuelve su contexto.
 */
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

module.exports = {
  fetchSubmission,
  userBelongsToTeam,
  isReviewerOfSubmission,
  ensureSubmissionAccess,
  fetchRevisionContext,
  ensureRevisionPermission
};
