const express = require('express');
const { requireAuth } = require('../../auth');
const { db } = require('../../db');
const {
  sendError,
  safeNumber,
  ensureAssignmentExists,
  ensureAssignmentRecord,
  cloneRosterTeamsToAssignment,
  fetchAssignmentRubric,
  buildAssignmentPlan,
  persistAssignmentPlan,
  fetchAssignmentMap
} = require('../helpers');
const { ROSTER_PREFIX } = require('../constants');

const router = express.Router();

router.get('/api/assignments', requireAuth(), (_req, res) => {
  try {
    const rows = db
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
               (SELECT COUNT(*) FROM revision rev WHERE rev.id_asignacion = a.id) AS asignacion_total_revisiones
        FROM tarea t
        LEFT JOIN asignacion a ON a.id_tarea = t.id
        WHERE t.titulo NOT LIKE ?
        ORDER BY t.fecha_entrega IS NULL, t.fecha_entrega DESC, t.id DESC
      `
      )
      .all(`${ROSTER_PREFIX}%`);

    res.json(rows);
  } catch (error) {
    console.error('Error al listar tareas:', error);
    return sendError(res, 500, 'No pudimos listar las tareas.');
  }
});

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
      .run(subjectId, title, description || null, dueDateRaw || null, req.user.id);

    const assignmentId = insert.lastInsertRowid;
    ensureAssignmentRecord(assignmentId);
    cloneRosterTeamsToAssignment(subjectId, assignmentId);

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
               (SELECT COUNT(*) FROM revision rev WHERE rev.id_asignacion = a.id) AS asignacion_total_revisiones
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
               (SELECT COUNT(*) FROM revision rev WHERE rev.id_asignacion = a.id) AS asignacion_total_revisiones
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

    const assignmentRecordId = ensureAssignmentRecord(assignmentId);
    db.prepare('DELETE FROM rubrica_items WHERE id_asignacion = ?').run(assignmentRecordId);

    const insertItem = db.prepare(`
      INSERT INTO rubrica_items (id_asignacion, titulo_rubrica, clave_item, texto, tipo, peso, obligatorio, minimo, maximo, orden)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const tx = db.transaction(() => {
      items.forEach((item, index) => {
        const clave = (item.clave || item.key || `item_${index + 1}`).trim();
        const texto = (item.texto || item.label || item.descripcion || '').trim();
        const peso = Number(item.peso ?? item.weight ?? 1) || 1;
        const tipo = item.tipo || 'numero';
        const obligatorio = item.obligatorio ? 1 : 0;

        insertItem.run(
          assignmentRecordId,
          'Rúbrica general',
          clave,
          texto || `Criterio ${index + 1}`,
          tipo,
          peso,
          obligatorio,
          item.minimo ?? null,
          item.maximo ?? null,
          index + 1
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

router.get('/api/assignments/:assignmentId/rubrica', requireAuth(), (req, res) => {
  try {
    const assignmentId = safeNumber(req.params.assignmentId);
    if (!assignmentId) {
      return sendError(res, 400, 'Identificador inválido.');
    }

    const items = fetchAssignmentRubric(assignmentId);
    res.json(items);
  } catch (error) {
    console.error('Error al obtener rúbrica:', error);
    return sendError(res, 500, 'No pudimos obtener la rúbrica.');
  }
});

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
