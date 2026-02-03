const crypto = require('crypto');
const { db } = require('../db');
const { buildSeededRandom, shuffleArray } = require('../utils/random');

/**
 * Verifica que la tarea existe y devuelve sus datos básicos de asignación.
 */
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

/**
 * Garantiza que exista un registro en asignacion para la tarea, devolviendo su id.
 */
function ensureAssignmentRecord(assignmentId) {
  const existing = db.prepare('SELECT id FROM asignacion WHERE id_tarea = ?').get(assignmentId);
  if (existing) {
    return existing.id;
  }
  const result = db.prepare('INSERT INTO asignacion (id_tarea) VALUES (?)').run(assignmentId);
  return result.lastInsertRowid;
}

/**
 * Obtiene los miembros de un equipo, ordenados por nombre.
 */
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

/**
 * Construye el contexto de asignación: entregas, equipos, nombres y miembros por equipo.
 */
function fetchAssignmentContext(assignmentId) {
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

  const teamNameMap = new Map();
  submissions.forEach((row) => {
    teamNameMap.set(row.equipo_autor_id, row.equipo_autor_nombre);
  });

  const submissionByTeam = new Map();
  submissions.forEach((row) => {
    submissionByTeam.set(row.equipo_autor_id, row.entrega_id);
  });

  const uniqueTeams = Array.from(new Set(submissions.map((row) => row.equipo_autor_id)));
  const teamMembers = new Map();
  uniqueTeams.forEach((teamId) => {
    teamMembers.set(teamId, getTeamMembers(teamId));
  });

  return {
    assignmentId,
    submissions,
    teamIds: uniqueTeams,
    teamNameMap,
    submissionByTeam,
    teamMembers
  };
}

/**
 * Asegura la entrada de un equipo revisado en el mapa acumulado.
 */
function ensureReviewedEntry(reviewedMap, teamId, context) {
  if (!reviewedMap.has(teamId)) {
    reviewedMap.set(teamId, {
      teamId,
      teamName: context.teamNameMap.get(teamId),
      submissionId: context.submissionByTeam.get(teamId),
      members: context.teamMembers.get(teamId) || [],
      reviewers: []
    });
  }
  return reviewedMap.get(teamId);
}

/**
 * Devuelve la lista de personas involucradas (miembro de equipo con entrega) sin duplicados.
 */
function listIndividualReviewers(assignmentId) {
  const rows = db
    .prepare(
      `
      SELECT DISTINCT u.id AS user_id,
             u.nombre_completo AS nombre,
             me.id_equipo AS team_id,
             eq.nombre AS team_nombre
      FROM miembro_equipo me
      JOIN usuario u ON u.id = me.id_usuario
      JOIN equipo eq ON eq.id = me.id_equipo
      WHERE eq.id_tarea = ?
        AND me.id_equipo IN (
          SELECT DISTINCT id_equipo
          FROM entregas
          WHERE id_tarea = ?
        )
      ORDER BY u.id
    `
    )
    .all(assignmentId, assignmentId);

  const seen = new Set();
  const reviewers = [];

  rows.forEach((row) => {
    if (seen.has(row.user_id)) {
      return;
    }
    seen.add(row.user_id);
    reviewers.push({
      userId: row.user_id,
      nombre: row.nombre,
      teamId: row.team_id,
      teamName: row.team_nombre
    });
  });

  return reviewers;
}

/**
 * Genera el plan en modo equipos: baraja equipos y asigna N siguientes evitando autorrevisión.
 */
function buildTeamPlan(context, requestedReviewsPerReviewer, randomFn) {
  const warnings = [];
  if (context.teamIds.length < 2) {
    warnings.push('Se necesitan al menos dos equipos con entrega para asignar revisiones.');
    return {
      appliedReviewsPerReviewer: 0,
      warnings,
      reviewers: [],
      reviewed: [],
      pairs: []
    };
  }

  const maxPerReviewer = context.teamIds.length - 1;
  const appliedReviewsPerReviewer = Math.min(requestedReviewsPerReviewer, maxPerReviewer);
  if (appliedReviewsPerReviewer < requestedReviewsPerReviewer) {
    warnings.push(`Solo hay ${maxPerReviewer} equipos distintos para revisar. Ajustamos a ${appliedReviewsPerReviewer}.`);
  }

  if (appliedReviewsPerReviewer < 1) {
    warnings.push('Se necesitan más equipos para asignar al menos una revisión por revisor.');
    return {
      appliedReviewsPerReviewer: 0,
      warnings,
      reviewers: [],
      reviewed: [],
      pairs: []
    };
  }

  const shuffledTeams = shuffleArray(context.teamIds, randomFn);
  const reviewedMap = new Map();
  const reviewersPreview = [];
  const pairs = [];

  shuffledTeams.forEach((reviewerTeamId, index) => {
    const targets = [];
    let offset = 1;
    while (targets.length < appliedReviewsPerReviewer) {
      const targetTeamId = shuffledTeams[(index + offset) % shuffledTeams.length];
      offset += 1;
      if (targetTeamId === reviewerTeamId) {
        continue;
      }
      if (targets.includes(targetTeamId)) {
        continue;
      }
      targets.push(targetTeamId);

      const reviewedEntry = ensureReviewedEntry(reviewedMap, targetTeamId, context);
      reviewedEntry.reviewers.push({
        id: reviewerTeamId,
        type: 'equipo',
        name: context.teamNameMap.get(reviewerTeamId),
        members: context.teamMembers.get(reviewerTeamId) || []
      });

      pairs.push({
        reviewerType: 'team',
        reviewerTeamId,
        reviewerName: context.teamNameMap.get(reviewerTeamId),
        targetTeamId,
        targetSubmissionId: context.submissionByTeam.get(targetTeamId)
      });
    }

    reviewersPreview.push({
      id: reviewerTeamId,
      type: 'equipo',
      name: context.teamNameMap.get(reviewerTeamId),
      members: context.teamMembers.get(reviewerTeamId) || [],
      targets: targets.map((teamId) => ({
        teamId,
        teamName: context.teamNameMap.get(teamId),
        submissionId: context.submissionByTeam.get(teamId)
      }))
    });
  });

  return {
    appliedReviewsPerReviewer,
    warnings,
    reviewers: reviewersPreview,
    reviewed: Array.from(reviewedMap.values()),
    pairs
  };
}

/**
 * Genera el plan en modo individual: baraja personas y asigna revisiones a otros equipos.
 */
function buildIndividualPlan(context, requestedReviewsPerReviewer, randomFn) {
  const warnings = [];
  if (context.teamIds.length < 2) {
    warnings.push('Se necesitan al menos dos equipos con entrega para asignar revisiones.');
    return {
      appliedReviewsPerReviewer: 0,
      warnings,
      reviewers: [],
      reviewed: [],
      pairs: [],
      totalReviewers: 0
    };
  }

  const reviewers = listIndividualReviewers(context.assignmentId);
  if (reviewers.length === 0) {
    warnings.push('No hay personas asociadas a los equipos con entrega.');
    return {
      appliedReviewsPerReviewer: 0,
      warnings,
      reviewers: [],
      reviewed: [],
      pairs: [],
      totalReviewers: 0
    };
  }

  const peopleOutsideTeam = reviewers.map((reviewer) => {
    const teamSize = context.teamMembers.get(reviewer.teamId)?.length || 0;
    return Math.max(0, reviewers.length - teamSize);
  });
  const minPeopleOutsideTeam = Math.min(...peopleOutsideTeam);
  const maxPerReviewerByTeams = context.teamIds.length - 1;
  const maxPossible = Math.min(maxPerReviewerByTeams, minPeopleOutsideTeam);
  const appliedReviewsPerReviewer = Math.min(requestedReviewsPerReviewer, maxPossible);

  if (appliedReviewsPerReviewer < 1) {
    warnings.push('No hay suficientes equipos distintos para asignar al menos una revisión por persona.');
    return {
      appliedReviewsPerReviewer: 0,
      warnings,
      reviewers: [],
      reviewed: [],
      pairs: [],
      totalReviewers: reviewers.length
    };
  }

  if (appliedReviewsPerReviewer < requestedReviewsPerReviewer) {
    warnings.push(
      `Cada persona solo puede revisar a ${maxPossible} equipos distintos (hay ${reviewers.length - 1} personas fuera de su equipo). Ajustamos a ${appliedReviewsPerReviewer}.`
    );
  }

  const shuffledReviewers = shuffleArray(reviewers, randomFn);
  const targetOrder = shuffleArray(context.teamIds, randomFn);
  const reviewedMap = new Map();
  const reviewersPreview = [];
  const pairs = [];

  shuffledReviewers.forEach((reviewer, index) => {
    const targets = [];
    const startIndex = (targetOrder.indexOf(reviewer.teamId) + 1 + index) % targetOrder.length;
    let step = 0;
    while (targets.length < appliedReviewsPerReviewer && step < targetOrder.length * 2) {
      const candidateTeamId = targetOrder[(startIndex + step) % targetOrder.length];
      step += 1;
      if (candidateTeamId === reviewer.teamId) {
        continue;
      }
      if (targets.includes(candidateTeamId)) {
        continue;
      }
      targets.push(candidateTeamId);
    }

    const reviewerLabel = reviewer.nombre || `Usuario ${reviewer.userId}`;
    const reviewerMembers = [{ id: reviewer.userId, nombre_completo: reviewerLabel }];

    reviewersPreview.push({
      id: reviewer.userId,
      type: 'usuario',
      name: reviewerLabel,
      teamId: reviewer.teamId,
      teamName: reviewer.teamName,
      members: reviewerMembers,
      targets: targets.map((teamId) => ({
        teamId,
        teamName: context.teamNameMap.get(teamId),
        submissionId: context.submissionByTeam.get(teamId)
      }))
    });

    targets.forEach((targetTeamId) => {
      const reviewedEntry = ensureReviewedEntry(reviewedMap, targetTeamId, context);
      reviewedEntry.reviewers.push({
        id: reviewer.userId,
        type: 'usuario',
        name: reviewerLabel,
        teamId: reviewer.teamId,
        teamName: reviewer.teamName,
        members: reviewerMembers
      });
      pairs.push({
        reviewerType: 'user',
        reviewerUserId: reviewer.userId,
        reviewerName: reviewerLabel,
        reviewerTeamId: reviewer.teamId,
        targetTeamId,
        targetSubmissionId: context.submissionByTeam.get(targetTeamId)
      });
    });
  });

  return {
    appliedReviewsPerReviewer,
    warnings,
    reviewers: reviewersPreview,
    reviewed: Array.from(reviewedMap.values()),
    pairs,
    totalReviewers: reviewers.length
  };
}

/**
 * Crea (o reutiliza) un equipo contenedor para un revisor individual y lo devuelve.
 */
function ensureIndividualReviewerTeam(assignmentId, userId, reviewerLabel = '') {
  const baseName = reviewerLabel ? reviewerLabel.trim() : `Usuario ${userId}`;
  const teamName = `[REV ${assignmentId}] ${baseName}`;
  const existing = db.prepare('SELECT id FROM equipo WHERE id_tarea = ? AND nombre = ?').get(assignmentId, teamName);
  if (existing) {
    db.prepare('INSERT OR IGNORE INTO miembro_equipo (id_equipo, id_usuario) VALUES (?, ?)').run(existing.id, userId);
    return existing.id;
  }

  const insertTeam = db.prepare('INSERT INTO equipo (id_tarea, nombre) VALUES (?, ?)').run(assignmentId, teamName);
  db.prepare('INSERT OR IGNORE INTO miembro_equipo (id_equipo, id_usuario) VALUES (?, ?)').run(insertTeam.lastInsertRowid, userId);
  return insertTeam.lastInsertRowid;
}

/**
 * Persiste el plan calculado en la base de datos y bloquea la asignación.
 */
function persistAssignmentPlan(plan) {
  if (!plan || !Array.isArray(plan.pairs) || plan.pairs.length === 0) {
    throw new Error('No hay asignaciones para guardar.');
  }

  const assignmentRecordId = ensureAssignmentRecord(plan.assignmentId);
  const assignedAt = new Date().toISOString();
  const insertRevision = db.prepare(
    `
    INSERT INTO revision (id_asignacion, id_entrega, id_revisores, fecha_asignacion)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id_entrega, id_revisores) DO UPDATE SET
      fecha_asignacion = ?,
      fecha_envio = NULL,
      respuestas_json = NULL,
      nota_numerica = NULL,
      comentario_extra = NULL
  `
  );

  const tx = db.transaction(() => {
    plan.pairs.forEach((pair) => {
      let reviewerTeamId = pair.reviewerTeamId;
      if (pair.reviewerType === 'user') {
        reviewerTeamId =
          pair.reviewerUserId
            ? ensureIndividualReviewerTeam(plan.assignmentId, pair.reviewerUserId, pair.reviewerName || '')
            : reviewerTeamId;
      }
      insertRevision.run(assignmentRecordId, pair.targetSubmissionId, reviewerTeamId, assignedAt, assignedAt);
    });

    const appliedReviews = plan.appliedReviewsPerReviewer || plan.requestedReviewsPerReviewer || 1;
    db.prepare(
      `
      UPDATE asignacion
      SET modo = ?, revisores_por_entrega = ?, bloqueada = 1, fecha_asignacion = ?
      WHERE id = ?
    `
    ).run(plan.mode, appliedReviews, assignedAt, assignmentRecordId);

    db.prepare('UPDATE tarea SET revisores_por_entrega = ? WHERE id = ?').run(appliedReviews, plan.assignmentId);
  });

  tx();

  const assignmentMeta = db
    .prepare(
      `
      SELECT modo, revisores_por_entrega, bloqueada, fecha_asignacion
      FROM asignacion
      WHERE id = ?
    `
    )
    .get(assignmentRecordId);

  return {
    assignmentRecordId,
    assignmentMeta
  };
}

/**
 * Construye una previsualización de asignación (equipo o individual) con validaciones y avisos.
 */
function buildAssignmentPlan({ assignmentId, mode = 'equipo', reviewsPerReviewer = 1, seed = null }) {
  const assignment = ensureAssignmentExists(assignmentId);
  if (!assignment) {
    throw new Error('La tarea no existe.');
  }

  const requestedReviewsPerReviewer = Math.max(1, Math.floor(Number(reviewsPerReviewer) || 0));
  const seedToUse = seed || crypto.randomBytes(8).toString('hex');
  const context = fetchAssignmentContext(assignmentId);
  const randomFn = buildSeededRandom(seedToUse);

  const planData =
    mode === 'individual'
      ? buildIndividualPlan(context, requestedReviewsPerReviewer, randomFn)
      : buildTeamPlan(context, requestedReviewsPerReviewer, randomFn);

  return {
    assignmentId,
    mode: mode === 'individual' ? 'individual' : 'equipo',
    seed: seedToUse,
    requestedReviewsPerReviewer,
    totalSubmissions: context.teamIds.length,
    totalReviewers: mode === 'individual' ? planData.totalReviewers ?? 0 : context.teamIds.length,
    ...planData
  };
}

/**
 * Ejecuta la asignación en modo equipos (N revisores siguientes), persiste y devuelve pares.
 */
function buildTeamAssignments(assignmentId, { reviewsPerReviewer = 1, seed = null } = {}) {
  const plan = buildAssignmentPlan({ assignmentId, mode: 'equipo', reviewsPerReviewer, seed });
  if (!plan.pairs || plan.pairs.length === 0) {
    return { assignmentId, pairs: [] };
  }

  persistAssignmentPlan(plan);

  const pairs = plan.reviewed.map((entry) => ({
    equipoAutor: {
      id: entry.teamId,
      nombre: entry.teamName
    },
    entregas: [entry.submissionId],
    revisores: entry.reviewers.map((rev) => ({
      id: rev.id,
      nombre: rev.name,
      revisores: rev.members
    }))
  }));

  return {
    assignmentId,
    pairs
  };
}

module.exports = {
  buildAssignmentPlan,
  persistAssignmentPlan,
  buildTeamAssignments
};
