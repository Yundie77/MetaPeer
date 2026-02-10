const express = require('express');
const { requireAuth } = require('../../auth');
const { db } = require('../../db');
const {
  sendError,
  safeNumber,
  ensureAssignmentExists,
  ensureAssignmentRecord,
  getTeamMembers,
  cloneRosterTeamsToAssignment,
  ensureDefaultRubricForAssignment,
  fetchAssignmentRubric,
  buildAssignmentPlan,
  persistAssignmentPlan,
  fetchAssignmentMap
} = require('../helpers');
const { ROSTER_PREFIX } = require('../constants');

const router = express.Router();

/**
 * Lista todas las tareas (excepto roster) con metadatos de asignación.
 */
router.get('/api/assignments', requireAuth(), (req, res) => {
  try {
    const rosterLike = `${ROSTER_PREFIX}%`;
    const isProf = req.user?.rol === 'PROF';
    const rows = isProf
      ? db
          .prepare(
            `
            SELECT t.id,
                   t.id_asignatura,
                   t.titulo,
                   t.descripcion,
                   t.fecha_entrega,
                   t.estado,
                   t.revisores_por_entrega,
                   COALESCE(a.modo, 'equipo') AS asignacion_modo,
                   a.revisores_por_entrega AS asignacion_revisores_por_entrega,
                   CASE
                     WHEN EXISTS (SELECT 1 FROM revision rev WHERE rev.id_asignacion = a.id) THEN 1
                     ELSE COALESCE(a.bloqueada, 0)
                   END AS asignacion_bloqueada,
                   a.fecha_asignacion AS asignacion_fecha_asignacion,
                   (SELECT COUNT(*) FROM revision rev WHERE rev.id_asignacion = a.id) AS asignacion_total_revisiones,
                   (SELECT COUNT(*) FROM equipo eq WHERE eq.id_tarea = t.id) AS total_equipos,
                   (SELECT COUNT(*) FROM entregas ent WHERE ent.id_tarea = t.id) AS total_entregas,
                   (
                     (SELECT COUNT(*) FROM entregas ent WHERE ent.id_tarea = t.id) *
                     COALESCE(a.revisores_por_entrega, t.revisores_por_entrega, 0)
                   ) AS revisiones_esperadas,
                   (
                     SELECT COUNT(*)
                     FROM revision rev
                     WHERE rev.id_asignacion = a.id
                       AND rev.fecha_envio IS NOT NULL
                   ) AS revisiones_realizadas,
                   (SELECT COUNT(*) FROM meta_revision mr WHERE mr.id_tarea = t.id) AS metarevisiones_realizadas
            FROM tarea t
            LEFT JOIN asignacion a ON a.id_tarea = t.id
            JOIN usuario_asignatura ua
              ON ua.id_asignatura = t.id_asignatura
             AND ua.id_usuario = ?
            WHERE t.titulo NOT LIKE ?
            ORDER BY t.id DESC
          `
          )
          .all(req.user.id, rosterLike)
      : db
          .prepare(
            `
            SELECT t.id,
                   t.id_asignatura,
                   t.titulo,
                   t.descripcion,
                   t.fecha_entrega,
                   t.estado,
                   t.revisores_por_entrega,
                   COALESCE(a.modo, 'equipo') AS asignacion_modo,
                   a.revisores_por_entrega AS asignacion_revisores_por_entrega,
                   CASE
                     WHEN EXISTS (SELECT 1 FROM revision rev WHERE rev.id_asignacion = a.id) THEN 1
                     ELSE COALESCE(a.bloqueada, 0)
                   END AS asignacion_bloqueada,
                   a.fecha_asignacion AS asignacion_fecha_asignacion,
                   (SELECT COUNT(*) FROM revision rev WHERE rev.id_asignacion = a.id) AS asignacion_total_revisiones,
                   (SELECT COUNT(*) FROM equipo eq WHERE eq.id_tarea = t.id) AS total_equipos,
                   (SELECT COUNT(*) FROM entregas ent WHERE ent.id_tarea = t.id) AS total_entregas,
                   (
                     (SELECT COUNT(*) FROM entregas ent WHERE ent.id_tarea = t.id) *
                     COALESCE(a.revisores_por_entrega, t.revisores_por_entrega, 0)
                   ) AS revisiones_esperadas,
                   (
                     SELECT COUNT(*)
                     FROM revision rev
                     WHERE rev.id_asignacion = a.id
                       AND rev.fecha_envio IS NOT NULL
                   ) AS revisiones_realizadas,
                   (SELECT COUNT(*) FROM meta_revision mr WHERE mr.id_tarea = t.id) AS metarevisiones_realizadas
            FROM tarea t
            LEFT JOIN asignacion a ON a.id_tarea = t.id
            WHERE t.titulo NOT LIKE ?
            ORDER BY t.id DESC
          `
          )
          .all(rosterLike);

    res.json(rows);
  } catch (error) {
    console.error('Error al listar tareas:', error);
    return sendError(res, 500, 'No pudimos listar las tareas.');
  }
});

/**
 * Crea una nueva tarea y copia equipos roster; devuelve la tarea creada.
 */
router.post('/api/assignments', requireAuth(['ADMIN', 'PROF']), (req, res) => {
  try {
    const title = (req.body?.titulo || req.body?.title || '').trim();
    const description = (req.body?.descripcion || req.body?.description || '').trim();
    const dueDateRaw = (req.body?.fechaEntrega || req.body?.dueDate || '').trim();
    const subjectId = safeNumber(req.body?.asignaturaId || req.body?.subjectId);

    if (!title) {
      return sendError(res, 400, 'El título es obligatorio.');
    }

    if (!subjectId) {
      return sendError(res, 400, 'Debes indicar la asignatura.');
    }
    if (!dueDateRaw) {
      return sendError(res, 400, 'La fecha de entrega es obligatoria.');
    }

    const subject = db.prepare('SELECT id FROM asignatura WHERE id = ?').get(subjectId);
    if (!subject) {
      return sendError(res, 404, 'La asignatura indicada no existe.');
    }

    const insert = db
      .prepare(
        `
        INSERT INTO tarea (id_asignatura, titulo, descripcion, fecha_entrega, estado, creado_por)
        VALUES (?, ?, ?, ?, 'abierta', ?)
      `
      )
      .run(subjectId, title, description || null, dueDateRaw, req.user.id);

    const assignmentId = insert.lastInsertRowid;
    ensureAssignmentRecord(assignmentId);
    cloneRosterTeamsToAssignment(subjectId, assignmentId);
    ensureDefaultRubricForAssignment(assignmentId);

    const created = db
      .prepare(
        `
        SELECT t.id,
               t.id_asignatura,
               t.titulo,
               t.descripcion,
               t.fecha_entrega,
               t.estado,
               t.revisores_por_entrega,
               COALESCE(a.modo, 'equipo') AS asignacion_modo,
               a.revisores_por_entrega AS asignacion_revisores_por_entrega,
               CASE
                 WHEN EXISTS (SELECT 1 FROM revision rev WHERE rev.id_asignacion = a.id) THEN 1
                 ELSE COALESCE(a.bloqueada, 0)
               END AS asignacion_bloqueada,
               a.fecha_asignacion AS asignacion_fecha_asignacion,
               (SELECT COUNT(*) FROM revision rev WHERE rev.id_asignacion = a.id) AS asignacion_total_revisiones,
               (SELECT COUNT(*) FROM equipo eq WHERE eq.id_tarea = t.id) AS total_equipos
        FROM tarea t
        LEFT JOIN asignacion a ON a.id_tarea = t.id
        WHERE t.id = ?
      `
      )
      .get(assignmentId);

    res.status(201).json(created);
  } catch (error) {
    console.error('Error al crear tarea:', error);
    return sendError(res, 500, 'No pudimos crear la tarea.');
  }
});

/**
 * Obtiene una tarea por id con información de asignación.
 */
router.get('/api/assignments/:assignmentId', requireAuth(), (req, res) => {
  try {
    const assignmentId = safeNumber(req.params.assignmentId);
    if (!assignmentId) {
      return sendError(res, 400, 'Identificador inválido.');
    }

    const existing = ensureAssignmentExists(assignmentId);
    if (!existing) {
      return sendError(res, 404, 'La tarea no existe.');
    }

    const assignment = db
      .prepare(
        `
        SELECT t.id,
               t.id_asignatura,
               t.titulo,
               t.descripcion,
               t.fecha_entrega,
               t.estado,
               t.revisores_por_entrega,
               COALESCE(a.modo, 'equipo') AS asignacion_modo,
               a.revisores_por_entrega AS asignacion_revisores_por_entrega,
               CASE
                 WHEN EXISTS (SELECT 1 FROM revision rev WHERE rev.id_asignacion = a.id) THEN 1
                 ELSE COALESCE(a.bloqueada, 0)
               END AS asignacion_bloqueada,
               a.fecha_asignacion AS asignacion_fecha_asignacion,
                   (SELECT COUNT(*) FROM revision rev WHERE rev.id_asignacion = a.id) AS asignacion_total_revisiones,
                   (SELECT COUNT(*) FROM equipo eq WHERE eq.id_tarea = t.id) AS total_equipos
        FROM tarea t
        LEFT JOIN asignacion a ON a.id_tarea = t.id
        WHERE t.id = ?
      `
      )
      .get(assignmentId);

    res.json(assignment);
  } catch (error) {
    console.error('Error al obtener tarea:', error);
    return sendError(res, 500, 'No pudimos obtener la tarea.');
  }
});

/**
 * Guarda los ítems de rúbrica para una tarea.
 */
router.post('/api/assignments/:assignmentId/rubrica', requireAuth(['ADMIN', 'PROF']), (req, res) => {
  try {
    const assignmentId = safeNumber(req.params.assignmentId);
    if (!assignmentId) {
      return sendError(res, 400, 'Identificador inválido.');
    }

    const assignment = ensureAssignmentExists(assignmentId);
    if (!assignment) {
      return sendError(res, 404, 'La tarea no existe.');
    }

    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (items.length === 0) {
      return sendError(res, 400, 'Debes enviar al menos un ítem de rúbrica.');
    }

    const normalizedItems = items.map((item, index) => {
      const clave = String(item.clave || item.key || `item_${index + 1}`).trim();
      const texto = (item.texto || item.label || item.descripcion || '').trim();
      const pesoRaw = item.peso ?? item.weight;
      const pesoNumber = Number(pesoRaw);
      const peso = Number.isFinite(pesoNumber) ? pesoNumber : 0;

      return {
        clave,
        texto: texto || `Criterio ${index + 1}`,
        peso
      };
    });

    const invalidWeightItem = normalizedItems.find((item) => Number(item.peso) <= 0);
    if (invalidWeightItem) {
      return sendError(res, 400, 'Cada criterio debe tener un porcentaje mayor que 0.');
    }

    const duplicateKeys = new Set();
    for (const item of normalizedItems) {
      if (!item.clave) {
        return sendError(res, 400, 'Todos los criterios deben tener una clave válida.');
      }
      if (duplicateKeys.has(item.clave)) {
        return sendError(res, 400, `La clave "${item.clave}" está repetida en la rúbrica.`);
      }
      duplicateKeys.add(item.clave);
    }

    const totalPeso = normalizedItems.reduce((acc, item) => acc + (Number(item.peso) || 0), 0);
    if (Math.abs(totalPeso - 100) > 0.001) {
      return sendError(res, 400, 'La suma de los pesos debe ser exactamente 100.');
    }

    const assignmentRecordId = ensureAssignmentRecord(assignmentId);
    db.prepare('DELETE FROM rubrica_items WHERE id_asignacion = ?').run(assignmentRecordId);

    const insertItem = db.prepare(`
      INSERT INTO rubrica_items (id_asignacion, clave_item, texto, peso)
      VALUES (?, ?, ?, ?)
    `);

    const tx = db.transaction(() => {
      normalizedItems.forEach((item) => {
        insertItem.run(
          assignmentRecordId,
          item.clave,
          item.texto,
          item.peso
        );
      });
    });

    tx();

    res.json({ ok: true });
  } catch (error) {
    console.error('Error al guardar rúbrica:', error);
    return sendError(res, 500, 'No pudimos guardar la rúbrica.');
  }
});

/**
 * Devuelve la rúbrica asociada a una tarea.
 */
router.get('/api/assignments/:assignmentId/rubrica', requireAuth(), (req, res) => {
  try {
    const assignmentId = safeNumber(req.params.assignmentId);
    if (!assignmentId) {
      return sendError(res, 400, 'Identificador inválido.');
    }

    const assignment = ensureAssignmentExists(assignmentId);
    if (!assignment) {
      return sendError(res, 404, 'La tarea no existe.');
    }

    const items = fetchAssignmentRubric(assignmentId);
    res.json(items);
  } catch (error) {
    console.error('Error al obtener rúbrica:', error);
    return sendError(res, 500, 'No pudimos obtener la rúbrica.');
  }
});

/**
 * Genera previsualización de asignación (equipo/individual) o la confirma y persiste.
 */
router.post('/api/assignments/:assignmentId/assign', requireAuth(['ADMIN', 'PROF']), (req, res) => {
  try {
    const assignmentId = safeNumber(req.params.assignmentId);
    if (!assignmentId) {
      return sendError(res, 400, 'Identificador inválido.');
    }

    const assignment = ensureAssignmentExists(assignmentId);
    if (!assignment) {
      return sendError(res, 404, 'La tarea no existe.');
    }

    const modeRaw = String(req.body?.modo || req.body?.mode || 'equipo').toLowerCase();
    const mode = modeRaw === 'individual' ? 'individual' : 'equipo';
    const requestedReviews = Math.floor(
      Number(
        req.body?.revisionesPorRevisor ??
          req.body?.revisores_por_entrega ??
          req.body?.revisoresPorEntrega ??
          req.body?.n ??
          req.body?.N
      ) || 0
    );
    if (!Number.isFinite(requestedReviews) || requestedReviews < 1) {
      return sendError(res, 400, 'Indica un número de revisiones por revisor mayor o igual a 1.');
    }

    const confirmFlag = Boolean(req.body?.confirmar || req.body?.confirm || req.body?.confirmado);
    const seed = req.body?.seed || req.body?.semilla || null;

    const assignmentRecord = db.prepare('SELECT id, bloqueada FROM asignacion WHERE id_tarea = ?').get(assignmentId);
    const assignmentRecordId = assignmentRecord ? assignmentRecord.id : ensureAssignmentRecord(assignmentId);
    const revisionsCount = db
      .prepare(
        `
        SELECT COUNT(*) AS total
        FROM revision
        WHERE id_asignacion = ?
      `
      )
      .get(assignmentRecordId)?.total;

    const isLocked = Number(assignmentRecord?.bloqueada) === 1 || Number(revisionsCount) > 0;
    if (isLocked) {
      return sendError(res, 409, 'Esta tarea ya tiene revisiones asignadas. No se puede relanzar.');
    }

    const plan = buildAssignmentPlan({
      assignmentId,
      mode,
      reviewsPerReviewer: requestedReviews,
      seed
    });

    if (!plan.pairs || plan.pairs.length === 0 || plan.appliedReviewsPerReviewer < 1) {
      const fallbackMessage =
        plan.warnings?.[0] || 'No pudimos generar la asignación. Verifica que haya entregas de al menos dos equipos.';
      return sendError(res, 400, fallbackMessage);
    }

    // console.log('PLAN GENERADO', plan); 

    let assignmentState = null;
    if (confirmFlag) {
      const persisted = persistAssignmentPlan(plan);
      assignmentState = {
        id_asignacion: persisted.assignmentRecordId,
        ...persisted.assignmentMeta
      };
    }

    const { pairs, ...preview } = plan;
    res.json({
      ...preview,
      warnings: plan.warnings || [],
      persisted: confirmFlag,
      assignmentState
    });
  } catch (error) {
    console.error('Error al generar asignación:', error);
    return sendError(res, 500, 'No pudimos generar la asignación.');
  }
});

/**
 * Resetea la asignación de una tarea eliminando revisiones y dependencias, sin borrar entregas.
 */
router.post('/api/assignments/:assignmentId/reset', requireAuth(['ADMIN', 'PROF']), (req, res) => {
  try {
    const assignmentId = safeNumber(req.params.assignmentId);
    if (!assignmentId) {
      return sendError(res, 400, 'Identificador inválido.');
    }

    const assignment = ensureAssignmentExists(assignmentId);
    if (!assignment) {
      return sendError(res, 404, 'La tarea no existe.');
    }

    const assignmentRecord = db.prepare('SELECT id FROM asignacion WHERE id_tarea = ?').get(assignmentId);
    const assignmentRecordId = assignmentRecord ? assignmentRecord.id : ensureAssignmentRecord(assignmentId);

    const reviewerPrefix = `[REV ${assignmentId}]%`;
    const selectReviewerTeams = db.prepare(
      `
      SELECT eq.id
      FROM equipo eq
      LEFT JOIN entregas ent ON ent.id_equipo = eq.id
      WHERE eq.id_tarea = ?
        AND eq.nombre LIKE ?
        AND ent.id IS NULL
    `
    );
    const deleteReviewerTeam = db.prepare('DELETE FROM equipo WHERE id = ?');
    const deleteMetaReviews = db.prepare('DELETE FROM meta_revision WHERE id_tarea = ?');
    const deleteRevisions = db.prepare('DELETE FROM revision WHERE id_asignacion = ?');
    const resetAssignment = db.prepare(
      `
      UPDATE asignacion
      SET bloqueada = 0,
          fecha_asignacion = NULL
      WHERE id = ?
    `
    );

    const tx = db.transaction(() => {
      deleteMetaReviews.run(assignmentId);
      deleteRevisions.run(assignmentRecordId);

      const reviewerTeams = selectReviewerTeams.all(assignmentId, reviewerPrefix);
      reviewerTeams.forEach((team) => {
        deleteReviewerTeam.run(team.id);
      });

      resetAssignment.run(assignmentRecordId);
    });

    tx();

    const updated = db
      .prepare(
        `
        SELECT t.id,
               t.id_asignatura,
               t.titulo,
               t.descripcion,
               t.fecha_entrega,
               t.estado,
               t.revisores_por_entrega,
               COALESCE(a.modo, 'equipo') AS asignacion_modo,
               a.revisores_por_entrega AS asignacion_revisores_por_entrega,
               CASE
                 WHEN EXISTS (SELECT 1 FROM revision rev WHERE rev.id_asignacion = a.id) THEN 1
                 ELSE COALESCE(a.bloqueada, 0)
               END AS asignacion_bloqueada,
               a.fecha_asignacion AS asignacion_fecha_asignacion,
               (SELECT COUNT(*) FROM revision rev WHERE rev.id_asignacion = a.id) AS asignacion_total_revisiones,
               (SELECT COUNT(*) FROM equipo eq WHERE eq.id_tarea = t.id) AS total_equipos
        FROM tarea t
        LEFT JOIN asignacion a ON a.id_tarea = t.id
        WHERE t.id = ?
      `
      )
      .get(assignmentId);

    res.json({ ok: true, assignment: updated });
  } catch (error) {
    console.error('Error al resetear asignación:', error);
    return sendError(res, 500, 'No pudimos reiniciar la asignación.');
  }
});

/**
 * Devuelve un resumen de la asignación con mapa, totales y estado de revisiones.
 */
router.get('/api/assignments/:assignmentId/assignment-summary', requireAuth(['ADMIN', 'PROF']), (req, res) => {
  try {
    const assignmentId = safeNumber(req.params.assignmentId);
    if (!assignmentId) {
      return sendError(res, 400, 'Identificador inválido.');
    }

    const assignment = ensureAssignmentExists(assignmentId);
    if (!assignment) {
      return sendError(res, 404, 'La tarea no existe.');
    }

    const assignmentRecord = db.prepare('SELECT id FROM asignacion WHERE id_tarea = ?').get(assignmentId);
    const assignmentRecordId = assignmentRecord ? assignmentRecord.id : null;

    // Resumen de la tarea y asignación
    const summaryAssignment = db
      .prepare(
        `
        SELECT t.id,
               t.id_asignatura,
               t.titulo,
               t.descripcion,
               t.fecha_entrega,
               t.estado,
               t.revisores_por_entrega,
               COALESCE(a.modo, 'equipo') AS asignacion_modo,
               a.revisores_por_entrega AS asignacion_revisores_por_entrega,
               /* 
               Si ya hay revisiones creadas, la asignación se considera bloqueada,
               aunque el campo bloqueada esté a 0.
               */
               CASE
                 WHEN EXISTS (SELECT 1 FROM revision rev WHERE rev.id_asignacion = a.id) THEN 1
                 ELSE COALESCE(a.bloqueada, 0)
               END AS asignacion_bloqueada,
               a.fecha_asignacion AS asignacion_fecha_asignacion,
               (SELECT COUNT(*) FROM revision rev WHERE rev.id_asignacion = a.id) AS asignacion_total_revisiones,
               (SELECT COUNT(*) FROM equipo eq WHERE eq.id_tarea = t.id) AS total_equipos
        FROM tarea t
        LEFT JOIN asignacion a ON a.id_tarea = t.id
        WHERE t.id = ?
      `
      )
      .get(assignmentId);

    const totalSubmissions =
      db.prepare('SELECT COUNT(*) AS total FROM entregas WHERE id_tarea = ?').get(assignmentId)?.total || 0;

    const totalReviews =
      assignmentRecordId
        ? db.prepare('SELECT COUNT(*) AS total FROM revision WHERE id_asignacion = ?').get(assignmentRecordId)?.total || 0
        : 0;
    const totalReviewers =
      assignmentRecordId
        ? db
            .prepare('SELECT COUNT(DISTINCT id_revisores) AS total FROM revision WHERE id_asignacion = ?')
            .get(assignmentRecordId)?.total || 0
        : 0;
    
    // Detalles de cada revisión realizada (mapa de revisiones)
    const revisionRows = assignmentRecordId
      ? db
          .prepare(
            `
            SELECT rev.id AS revision_id,
                   rev.id_entrega AS submission_id,
                   rev.id_revisores AS reviewer_team_id,
                   rev.fecha_asignacion AS assigned_at,
                   rev.fecha_envio AS submitted_at,
                   rev.nota_numerica AS grade,
                   rev.comentario_extra AS comment,
                   mr.nota_final AS meta_grade,
                   mr.fecha_registro AS meta_registered_at,
                   ent.id_equipo AS author_team_id,
                   equipo_autor.nombre AS author_team_name,
                   equipo_revisor.nombre AS reviewer_team_name
            FROM revision rev
            JOIN entregas ent ON ent.id = rev.id_entrega
            JOIN equipo equipo_autor ON equipo_autor.id = ent.id_equipo
            JOIN equipo equipo_revisor ON equipo_revisor.id = rev.id_revisores
            LEFT JOIN meta_revision mr ON mr.id_revision = rev.id
            WHERE rev.id_asignacion = ?
            ORDER BY rev.id
          `
          )
          .all(assignmentRecordId)
      : [];

    const reviewerMap = new Map(); // clave: reviewer_team_id, valor: { id, type, name, teamName, members, targets }
    const reviewedMap = new Map(); // clave: author_team_id, valor: { teamId, teamName, submissionId, members, reviewers }
    const reviewerMembersCache = new Map(); 
    const authorMembersCache = new Map();
    
    // Evitar usar varias veces getTeamMembers
    const getCachedMembers = (teamId, cache) => {
      if (!cache.has(teamId)) {
        cache.set(teamId, getTeamMembers(teamId));
      }
      return cache.get(teamId);
    };

    const reviews = revisionRows.map((row) => {
      const reviewerMembers = getCachedMembers(row.reviewer_team_id, reviewerMembersCache); 
      const authorMembers = getCachedMembers(row.author_team_id, authorMembersCache);
      const reviewerPrefix = `[REV ${assignmentId}]`;
      const isIndividual = (row.reviewer_team_name || '').startsWith(reviewerPrefix);
      const reviewerName = isIndividual
        ? reviewerMembers?.[0]?.nombre_completo || reviewerMembers?.[0]?.nombre || row.reviewer_team_name
        : row.reviewer_team_name;

      if (!reviewerMap.has(row.reviewer_team_id)) {
        reviewerMap.set(row.reviewer_team_id, {
          id: row.reviewer_team_id,
          type: isIndividual ? 'usuario' : 'equipo',
          name: reviewerName,
          teamName: isIndividual ? null : row.reviewer_team_name,
          members: reviewerMembers || [],
          targets: []
        });
      }

      reviewerMap.get(row.reviewer_team_id).targets.push({
        teamId: row.author_team_id,
        teamName: row.author_team_name,
        submissionId: row.submission_id
      });

      if (!reviewedMap.has(row.author_team_id)) {
        reviewedMap.set(row.author_team_id, {
          teamId: row.author_team_id,
          teamName: row.author_team_name,
          submissionId: row.submission_id,
          members: authorMembers || [],
          reviewers: []
        });
      }

      reviewedMap.get(row.author_team_id).reviewers.push({
        id: row.reviewer_team_id,
        type: isIndividual ? 'usuario' : 'equipo',
        name: reviewerName,
        teamName: row.reviewer_team_name,
        members: reviewerMembers || []
      });

      return {
        revisionId: row.revision_id,
        submissionId: row.submission_id,
        reviewerTeamId: row.reviewer_team_id,
        reviewerName,
        reviewerType: isIndividual ? 'usuario' : 'equipo',
        reviewerTeamName: row.reviewer_team_name,
        authorTeamId: row.author_team_id,
        authorTeamName: row.author_team_name,
        assignedAt: row.assigned_at,
        submittedAt: row.submitted_at,
        grade: row.grade,
        comment: row.comment,
        metaGrade: row.meta_grade,
        metaRegisteredAt: row.meta_registered_at
      };
    });

    const totalExpectedReviews =
      totalSubmissions * Number(summaryAssignment?.asignacion_revisores_por_entrega || summaryAssignment?.revisores_por_entrega || 0);
    const totalSubmittedReviews = reviews.reduce(
      (acc, review) => acc + (review.submittedAt ? 1 : 0),
      0
    );
    const totalMetaReviews = reviews.reduce(
      (acc, review) =>
        acc +
        (review.metaRegisteredAt || review.metaGrade !== null && review.metaGrade !== undefined ? 1 : 0),
      0
    );

    res.json({
      assignment: summaryAssignment,
      totals: {
        totalSubmissions,
        totalReviewers,
        totalReviews,
        totalExpectedReviews,
        totalSubmittedReviews,
        totalMetaReviews
      },
      map: {
        reviewers: Array.from(reviewerMap.values()),
        reviewed: Array.from(reviewedMap.values())
      },
      reviews
    });
  } catch (error) {
    console.error('Error al obtener resumen de asignación:', error);
    return sendError(res, 500, 'No pudimos obtener el resumen de la asignación.');
  }
});

/**
 * Devuelve el mapa actual de revisiones asignadas para una tarea.
 */
router.get('/api/assignments/:assignmentId/assignment-map', requireAuth(['ADMIN', 'PROF']), (req, res) => {
  try {
    const assignmentId = safeNumber(req.params.assignmentId);
    if (!assignmentId) {
      return sendError(res, 400, 'Identificador inválido.');
    }

    const result = fetchAssignmentMap(assignmentId);
    res.json(result);
  } catch (error) {
    console.error('Error al obtener asignación:', error);
    return sendError(res, 500, 'No pudimos obtener la asignación.');
  }
});

module.exports = router;
