const express = require('express');
const { requireAuth } = require('../../auth');
const { db } = require('../../db');
const { sendError, safeNumber, getTeamMembers, getProfessorSubjects } = require('../helpers');
const { ROSTER_PREFIX } = require('../constants');

const router = express.Router();

const ROSTER_LIKE = `${ROSTER_PREFIX}%`;
const MAX_EVENTS = 200;

function getUserById(userId) {
  return db
    .prepare(
      `
      SELECT id, nombre_completo, correo, rol
      FROM usuario
      WHERE id = ?
    `
    )
    .get(userId);
}

function listRelevantAssignments(user) {
  if (!user) {
    return [];
  }
  if (user.rol === 'ADMIN') {
    return db
      .prepare(
        `
        SELECT
          t.id,
          t.titulo,
          t.id_asignatura,
          a.nombre AS asignatura_nombre
        FROM tarea t
        LEFT JOIN asignatura a ON a.id = t.id_asignatura
        WHERE t.titulo NOT LIKE ?
        ORDER BY t.id DESC
      `
      )
      .all(ROSTER_LIKE);
  }

  return db
    .prepare(
      `
      SELECT DISTINCT
        t.id,
        t.titulo,
        t.id_asignatura,
        a.nombre AS asignatura_nombre
      FROM tarea t
      LEFT JOIN asignatura a ON a.id = t.id_asignatura
      JOIN usuario_asignatura ua
        ON ua.id_asignatura = t.id_asignatura
       AND ua.id_usuario = @userId
      WHERE t.titulo NOT LIKE @rosterLike
      ORDER BY t.id DESC
    `
    )
    .all({ userId: user.id, rosterLike: ROSTER_LIKE });
}

function listAllSubjects() {
  return db
    .prepare(
      `
      SELECT id, nombre
      FROM asignatura
      ORDER BY nombre
    `
    )
    .all();
}

// Si ids = [3, 7, 9] devuelve: ?, ?, ?
function buildInClause(ids = []) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return '';
  }
  return ids.map(() => '?').join(', ');
}

function listAssignmentRecords(assignmentIds = []) {
  if (!assignmentIds.length) {
    return [];
  }

  const inClause = buildInClause(assignmentIds);
  return db
    .prepare(
      `
      SELECT
        asg.id AS asignacion_id,
        asg.id_tarea AS assignment_id,
        asg.fecha_asignacion,
        asg.modo,
        asg.revisores_por_entrega,
        t.titulo AS assignment_title,
        t.id_asignatura AS subject_id,
        a.nombre AS subject_name
      FROM asignacion asg
      JOIN tarea t ON t.id = asg.id_tarea
      LEFT JOIN asignatura a ON a.id = t.id_asignatura
      WHERE asg.id_tarea IN (${inClause})
        AND t.titulo NOT LIKE ?
    `
    )
    .all(...assignmentIds, ROSTER_LIKE);
}

function listRevisionRows(assignmentRecordIds = []) {
  if (!assignmentRecordIds.length) {
    return [];
  }

  const inClause = buildInClause(assignmentRecordIds);
  return db
    .prepare(
      `
      SELECT
        rev.id AS review_id,
        rev.id_entrega AS submission_id,
        rev.id_revisores AS reviewer_team_id,
        rev.fecha_asignacion,
        rev.fecha_envio,
        asg.id_tarea AS assignment_id,
        t.titulo AS assignment_title,
        t.id_asignatura AS subject_id,
        a.nombre AS subject_name,
        ent.id_equipo AS author_team_id,
        autor.nombre AS author_team_name,
        revisor.nombre AS reviewer_team_name
      FROM revision rev
      JOIN asignacion asg ON asg.id = rev.id_asignacion
      JOIN tarea t ON t.id = asg.id_tarea
      LEFT JOIN asignatura a ON a.id = t.id_asignatura
      JOIN entregas ent ON ent.id = rev.id_entrega
      JOIN equipo autor ON autor.id = ent.id_equipo
      JOIN equipo revisor ON revisor.id = rev.id_revisores
      WHERE rev.id_asignacion IN (${inClause})
        AND t.titulo NOT LIKE ?
      ORDER BY rev.fecha_asignacion DESC, rev.id DESC
    `
    )
    .all(...assignmentRecordIds, ROSTER_LIKE);
}

function listBatchUploads(userId, assignmentIds = []) {
  if (!assignmentIds.length) {
    return [];
  }

  const inClause = buildInClause(assignmentIds);
  return db
    .prepare(
      `
      SELECT
        ce.id,
        ce.id_tarea AS assignment_id,
        ce.fecha_subida,
        ce.nombre_zip,
        ce.total_equipos,
        t.titulo AS assignment_title,
        t.id_asignatura AS subject_id,
        a.nombre AS subject_name
      FROM carga_entregas ce
      JOIN tarea t ON t.id = ce.id_tarea
      LEFT JOIN asignatura a ON a.id = t.id_asignatura
      WHERE ce.id_profesor = ?
        AND ce.id_tarea IN (${inClause})
        AND t.titulo NOT LIKE ?
      ORDER BY ce.fecha_subida DESC, ce.id DESC
    `
    )
    .all(userId, ...assignmentIds, ROSTER_LIKE);
}

function listMetaReviews(userId, assignmentIds = []) {
  if (!assignmentIds.length) {
    return [];
  }

  const inClause = buildInClause(assignmentIds);
  return db
    .prepare(
      `
      SELECT
        mr.id,
        mr.id_tarea AS assignment_id,
        mr.id_revision AS review_id,
        mr.id_entrega AS submission_id,
        mr.nota_calidad,
        mr.observacion,
        mr.fecha_registro,
        t.titulo AS assignment_title,
        t.id_asignatura AS subject_id,
        a.nombre AS subject_name
      FROM meta_revision mr
      JOIN tarea t ON t.id = mr.id_tarea
      LEFT JOIN asignatura a ON a.id = t.id_asignatura
      WHERE mr.id_profesor = ?
        AND mr.id_tarea IN (${inClause})
        AND t.titulo NOT LIKE ?
      ORDER BY mr.fecha_registro DESC, mr.id DESC
    `
    )
    .all(userId, ...assignmentIds, ROSTER_LIKE);
}

function buildReviewerResolver() {
  const membersCache = new Map();

  const getCachedMembers = (teamId) => {
    if (!membersCache.has(teamId)) {
      membersCache.set(teamId, getTeamMembers(teamId) || []);
    }
    return membersCache.get(teamId);
  };

  return ({ reviewerTeamId, reviewerTeamName, assignmentId }) => {
    const reviewerPrefix = `[REV ${assignmentId}]`;
    const isIndividual = (reviewerTeamName || '').startsWith(reviewerPrefix);
    const reviewerMembers = getCachedMembers(reviewerTeamId);
    const reviewerName = isIndividual
      ? reviewerMembers?.[0]?.nombre_completo || reviewerTeamName || `Revisor ${reviewerTeamId}`
      : reviewerTeamName || `Equipo ${reviewerTeamId}`;

    return {
      isIndividual,
      reviewerName,
      reviewerMembers
    };
  };
}

function normalizeTimestamp(value) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

function buildEvents({ assignmentRecords, revisionRows, batchUploads, metaReviews }) {
  const events = [];
  const resolveReviewer = buildReviewerResolver();

  assignmentRecords.forEach((row) => {
    const timestamp = normalizeTimestamp(row.fecha_asignacion);
    if (!timestamp) {
      return;
    }
    events.push({
      id: `assignment_assigned_${row.asignacion_id}`,
      type: 'assignment_assigned',
      timestamp,
      title: 'Asignación creada/asignada',
      description: `Se asignaron revisiones para ${row.assignment_title || `tarea ${row.assignment_id}`}.`,
      assignmentId: row.assignment_id,
      assignmentTitle: row.assignment_title,
      subjectId: row.subject_id,
      subjectName: row.subject_name
    });
  });

  revisionRows.forEach((row) => {
    const reviewer = resolveReviewer({
      reviewerTeamId: row.reviewer_team_id,
      reviewerTeamName: row.reviewer_team_name,
      assignmentId: row.assignment_id
    });

    const assignedAt = normalizeTimestamp(row.fecha_asignacion);
    if (assignedAt) {
      events.push({
        id: `review_assigned_${row.review_id}`,
        type: 'review_assigned',
        timestamp: assignedAt,
        title: 'Revisión asignada',
        description: `${reviewer.reviewerName} revisa a ${row.author_team_name}.`,
        assignmentId: row.assignment_id,
        assignmentTitle: row.assignment_title,
        subjectId: row.subject_id,
        subjectName: row.subject_name,
        reviewId: row.review_id,
        submissionId: row.submission_id,
        actor: reviewer.isIndividual
          ? {
              id: reviewer.reviewerMembers?.[0]?.id,
              name: reviewer.reviewerName
            }
          : {
              id: row.reviewer_team_id,
              name: reviewer.reviewerName
            }
      });
    }

    const submittedAt = normalizeTimestamp(row.fecha_envio);
    if (submittedAt) {
      events.push({
        id: `review_submitted_${row.review_id}`,
        type: 'review_submitted',
        timestamp: submittedAt,
        title: 'Revisión enviada',
        description: `${reviewer.reviewerName} envió revisión para ${row.author_team_name}.`,
        assignmentId: row.assignment_id,
        assignmentTitle: row.assignment_title,
        subjectId: row.subject_id,
        subjectName: row.subject_name,
        reviewId: row.review_id,
        submissionId: row.submission_id,
        actor: reviewer.isIndividual
          ? {
              id: reviewer.reviewerMembers?.[0]?.id,
              name: reviewer.reviewerName
            }
          : {
              id: row.reviewer_team_id,
              name: reviewer.reviewerName
            }
      });
    }
  });

  batchUploads.forEach((row) => {
    const timestamp = normalizeTimestamp(row.fecha_subida);
    if (!timestamp) {
      return;
    }
    const teamsCount = Number(row.total_equipos) || 0;
    const teamsLabel = teamsCount === 1 ? '1 equipo' : `${teamsCount} equipos`;
    events.push({
      id: `submissions_batch_uploaded_${row.id}`,
      type: 'submissions_batch_uploaded',
      timestamp,
      title: 'Entregas cargadas en lote',
      description: `Se subió ${row.nombre_zip || 'un ZIP'} con ${teamsLabel}.`,
      assignmentId: row.assignment_id,
      assignmentTitle: row.assignment_title,
      subjectId: row.subject_id,
      subjectName: row.subject_name
    });
  });

  metaReviews.forEach((row) => {
    const timestamp = normalizeTimestamp(row.fecha_registro);
    if (!timestamp) {
      return;
    }
    const gradeLabel =
      row.nota_calidad !== null && row.nota_calidad !== undefined ? ` Nota de calidad: ${row.nota_calidad}.` : '';
    events.push({
      id: `meta_review_${row.id}`,
      type: 'meta_review',
      timestamp,
      title: 'Meta-revisión registrada',
      description: `Se registró una meta-revisión.${gradeLabel}`,
      assignmentId: row.assignment_id,
      assignmentTitle: row.assignment_title,
      subjectId: row.subject_id,
      subjectName: row.subject_name,
      reviewId: row.review_id,
      submissionId: row.submission_id
    });
  });

  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return events.slice(0, MAX_EVENTS);
}

function buildProfilePayload(userId) {
  const user = getUserById(userId);
  if (!user) {
    return null;
  }

  const subjects = user.rol === 'ADMIN' ? listAllSubjects() : getProfessorSubjects(userId) || [];
  const relevantAssignments = listRelevantAssignments(user);
  const assignmentIds = relevantAssignments.map((row) => row.id);
  const assignmentRecords = listAssignmentRecords(assignmentIds);
  const assignmentRecordIds = assignmentRecords.map((row) => row.asignacion_id);
  const revisionRows = listRevisionRows(assignmentRecordIds);
  const batchUploads = listBatchUploads(userId, assignmentIds);
  const metaReviews = listMetaReviews(userId, assignmentIds);

  const assignmentsAssignedCount = assignmentRecords.filter((row) => normalizeTimestamp(row.fecha_asignacion)).length;
  const reviewsAssignedCount = revisionRows.length;
  const reviewsSubmittedCount = revisionRows.filter((row) => normalizeTimestamp(row.fecha_envio)).length;
  const metaReviewsCount = metaReviews.length;
  const batchesUploadedCount = batchUploads.length;

  const events = buildEvents({
    assignmentRecords,
    revisionRows,
    batchUploads,
    metaReviews
  });

  return {
    profile: {
      id: user.id,
      nombre: user.nombre_completo,
      email: user.correo,
      rol: user.rol
    },
    subjects,
    stats: {
      assignmentsAssignedCount,
      reviewsAssignedCount,
      reviewsSubmittedCount,
      metaReviewsCount,
      batchesUploadedCount
    },
    events
  };
}

router.get('/api/profile', requireAuth(), (req, res) => {
  try {
    const payload = buildProfilePayload(req.user.id);
    if (!payload) {
      return sendError(res, 404, 'No encontramos el perfil.');
    }
    return res.json(payload);
  } catch (error) {
    console.error('Error al construir el perfil:', error);
    return sendError(res, 500, 'No pudimos construir el perfil.');
  }
});

router.get('/api/profiles/:userId/events', requireAuth(['ADMIN']), (req, res) => {
  try {
    const userId = safeNumber(req.params.userId);
    if (!userId) {
      return sendError(res, 400, 'Identificador inválido.');
    }

    const user = getUserById(userId);
    if (!user) {
      return sendError(res, 404, 'El usuario no existe.');
    }
    if (user.rol !== 'PROF') {
      return sendError(res, 400, 'El perfil solicitado no es de profesor.');
    }

    const payload = buildProfilePayload(userId);
    return res.json(payload);
  } catch (error) {
    console.error('Error al construir el perfil de profesor:', error);
    return sendError(res, 500, 'No pudimos construir el perfil del profesor.');
  }
});

module.exports = router;

