const express = require('express');
const fs = require('fs');
const fsp = fs.promises;
const { requireAuth } = require('../../auth');
const { db } = require('../../db');
const { listAllFiles, ensureInside, contentFolder } = require('../../utils/deliveries');
const { fileHash } = require('../../utils/fileHash');
const {
  sendError,
  safeNumber,
  ensureRevisionPermission,
  isLikelyBinary,
  getTeamMembers
} = require('../helpers');

const router = express.Router();

router.get('/api/reviews/:revisionId/files', requireAuth(), async (req, res) => {
  try {
    const revisionId = safeNumber(req.params.revisionId);
    if (!revisionId) {
      return sendError(res, 400, 'Identificador de revisión inválido.');
    }

    const revision = ensureRevisionPermission(revisionId, req.user, { allowOwners: true });
    if (!revision) {
      return sendError(res, 403, 'No puedes ver los archivos de esta revisión.');
    }

    const baseDir = contentFolder(revision.assignment_id, revision.author_team_id);
    if (!fs.existsSync(baseDir)) {
      return sendError(res, 404, 'Todavía no hay archivos descomprimidos para esta entrega.');
    }

    const files = await listAllFiles(baseDir);
    return res.json({
      revisionId,
      submissionId: revision.submission_id,
      zipName: revision.zip_name,
      files
    });
  } catch (error) {
    console.error('Error al listar archivos de revisión:', error);
    return sendError(res, 500, 'No pudimos cargar el árbol de archivos.');
  }
});

router.get('/api/reviews/:revisionId/file', requireAuth(), async (req, res) => {
  try {
    const revisionId = safeNumber(req.params.revisionId);
    const relativePath = (req.query.path || '').toString().replace(/^[\\/]+/, '').trim();

    if (!revisionId || !relativePath) {
      return sendError(res, 400, 'Debes indicar la revisión y el archivo.');
    }

    const revision = ensureRevisionPermission(revisionId, req.user, { allowOwners: true });
    if (!revision) {
      return sendError(res, 403, 'No puedes abrir este archivo.');
    }

    const baseDir = contentFolder(revision.assignment_id, revision.author_team_id);
    if (!fs.existsSync(baseDir)) {
      return sendError(res, 404, 'No encontramos los archivos descomprimidos.');
    }

    const absolutePath = ensureInside(baseDir, relativePath);
    const stats = await fsp.stat(absolutePath);
    if (!stats.isFile()) {
      return sendError(res, 400, 'La ruta indicada no es un fichero.');
    }

    const buffer = await fsp.readFile(absolutePath);
    const isBinary = isLikelyBinary(buffer);
    const sha1 = await fileHash(absolutePath, 'sha1');

    const comments = db
      .prepare(
        `
        SELECT cc.id,
               cc.linea,
               cc.contenido,
               cc.creado_en,
               usr.nombre_completo AS autor_nombre,
               usr.correo          AS autor_correo
        FROM code_comment cc
        LEFT JOIN usuario usr ON usr.id = cc.autor_id
        WHERE cc.revision_id = ?
          AND cc.sha1 = ?
        ORDER BY cc.linea, cc.id
      `
      )
      .all(revisionId, sha1)
      .map((row) => ({
        id: row.id,
        linea: row.linea,
        contenido: row.contenido,
        creado_en: row.creado_en,
        autor: row.autor_nombre ? { nombre: row.autor_nombre, correo: row.autor_correo } : null
      }));

    return res.json({
      path: relativePath.replace(/\\/g, '/'),
      size: stats.size,
      isBinary,
      sha1,
      content: isBinary ? null : buffer.toString('utf8'),
      comments
    });
  } catch (error) {
    console.error('Error al leer archivo de revisión:', error);
    return sendError(res, 500, 'No pudimos abrir el archivo solicitado.');
  }
});

router.post('/api/reviews/:revisionId/comments', requireAuth(), async (req, res) => {
  try {
    const revisionId = safeNumber(req.params.revisionId);
    const relativePath = (req.body?.path || req.body?.ruta || '').toString().replace(/^[\\/]+/, '').trim();
    const linea = safeNumber(req.body?.line || req.body?.linea);
    const contenido = (req.body?.contenido || req.body?.text || '').toString().trim();

    if (!revisionId || !relativePath) {
      return sendError(res, 400, 'Falta indicar el archivo.');
    }
    if (!linea || linea <= 0) {
      return sendError(res, 400, 'La línea indicada no es válida.');
    }
    if (!contenido) {
      return sendError(res, 400, 'El comentario no puede estar vacío.');
    }

    const revision = ensureRevisionPermission(revisionId, req.user);
    if (!revision) {
      return sendError(res, 403, 'No puedes comentar este archivo.');
    }

    const baseDir = contentFolder(revision.assignment_id, revision.author_team_id);
    if (!fs.existsSync(baseDir)) {
      return sendError(res, 404, 'No encontramos los archivos de la entrega.');
    }

    const absolutePath = ensureInside(baseDir, relativePath);
    const stats = await fsp.stat(absolutePath);
    if (!stats.isFile()) {
      return sendError(res, 400, 'Solo puedes comentar archivos.');
    }

    const sha1 = await fileHash(absolutePath, 'sha1');

    const insert = db
      .prepare(
        `
        INSERT INTO code_comment (revision_id, sha1, ruta_archivo, linea, contenido, autor_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `
      )
      .run(revisionId, sha1, relativePath.replace(/\\/g, '/'), linea, contenido, req.user.id);

    const created = db
      .prepare(
        `
        SELECT cc.id,
               cc.linea,
               cc.contenido,
               cc.creado_en,
               usr.nombre_completo AS autor_nombre,
               usr.correo          AS autor_correo
        FROM code_comment cc
        LEFT JOIN usuario usr ON usr.id = cc.autor_id
        WHERE cc.id = ?
      `
      )
      .get(insert.lastInsertRowid);

    return res.status(201).json({
      id: created.id,
      linea: created.linea,
      contenido: created.contenido,
      creado_en: created.creado_en,
      autor: created.autor_nombre ? { nombre: created.autor_nombre, correo: created.autor_correo } : null,
      sha1
    });
  } catch (error) {
    console.error('Error al guardar comentario de código:', error);
    return sendError(res, 500, 'No pudimos guardar el comentario.');
  }
});

router.get('/api/reviews', requireAuth(), (req, res) => {
  try {
    const submissionId = safeNumber(req.query.submissionId);
    if (!submissionId) {
      return sendError(res, 400, 'Debes indicar submissionId.');
    }

    const rows = db
      .prepare(
        `
        SELECT rev.id,
               rev.id_entrega,
               rev.id_revisores,
               rev.fecha_asignacion,
               rev.fecha_envio,
               rev.respuestas_json,
               rev.nota_numerica,
               rev.comentario_extra,
               eq.nombre AS equipo_revisor_nombre
        FROM revision rev
        JOIN equipo eq ON eq.id = rev.id_revisores
        WHERE rev.id_entrega = ?
        ORDER BY rev.fecha_asignacion DESC
      `
      )
      .all(submissionId);

    const formatted = rows.map((row) => ({
      id: row.id,
      id_entrega: row.id_entrega,
      equipo_revisor: {
        id: row.id_revisores,
        nombre: row.equipo_revisor_nombre,
        miembros: getTeamMembers(row.id_revisores)
      },
      fecha_asignacion: row.fecha_asignacion,
      fecha_envio: row.fecha_envio,
      respuestas: row.respuestas_json ? JSON.parse(row.respuestas_json) : null,
      nota_numerica: row.nota_numerica,
      comentario: row.comentario_extra
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Error al listar revisiones:', error);
    return sendError(res, 500, 'No pudimos obtener las revisiones.');
  }
});

router.get('/api/my-review-tasks', requireAuth(['ALUM']), (req, res) => {
  try {
    const rows = db
      .prepare(
        `
        SELECT DISTINCT
          rev.id,
          rev.id_entrega,
          rev.fecha_asignacion,
          rev.fecha_envio,
          rev.respuestas_json,
          rev.nota_numerica,
          rev.comentario_extra,
          ent.id_tarea AS assignment_id,
          tar.titulo AS assignment_title,
          ent.nombre_zip AS submission_zip,
          ent.fecha_subida AS submission_date
        FROM revision rev
        JOIN equipo eq ON eq.id = rev.id_revisores
        JOIN miembro_equipo me ON me.id_equipo = eq.id
        JOIN entregas ent ON ent.id = rev.id_entrega
        JOIN tarea tar ON tar.id = ent.id_tarea
        WHERE me.id_usuario = ?
        ORDER BY rev.fecha_asignacion DESC
      `
      )
      .all(req.user.id);

    const formatted = rows.map((row) => ({
      id: row.id,
      assignmentId: row.assignment_id,
      assignmentTitle: row.assignment_title,
      submissionId: row.id_entrega,
      submissionZip: row.submission_zip,
      assignedAt: row.fecha_asignacion,
      submittedAt: row.fecha_envio,
      nota_numerica: row.nota_numerica,
      comentario: row.comentario_extra,
      respuestas: row.respuestas_json ? JSON.parse(row.respuestas_json) : null
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Error al listar tareas de revisión:', error);
    return sendError(res, 500, 'No pudimos obtener tus revisiones.');
  }
});

router.post('/api/reviews', requireAuth(['ALUM']), (req, res) => {
  try {
    const submissionId = safeNumber(req.body?.submissionId);
    const reviewerUserId = safeNumber(req.body?.reviewerUserId) || req.user.id;
    const respuestasJson = req.body?.respuestasJson || req.body?.respuestas || null;
    const comentario = (req.body?.comentario || req.body?.comentarioExtra || '').trim();
    const notaNumerica = req.body?.notaNumerica !== undefined ? Number(req.body.notaNumerica) : null;

    if (!submissionId) {
      return sendError(res, 400, 'Debes indicar submissionId.');
    }

    if (reviewerUserId !== req.user.id) {
      return sendError(res, 403, 'Solo puedes completar tus propias revisiones.');
    }

    const revision = db
      .prepare(
        `
        SELECT rev.id
        FROM revision rev
        JOIN equipo eq ON eq.id = rev.id_revisores
        JOIN miembro_equipo me ON me.id_equipo = eq.id
        WHERE rev.id_entrega = ?
          AND me.id_usuario = ?
      `
      )
      .get(submissionId, req.user.id);

    if (!revision) {
      return sendError(res, 404, 'No tienes una revisión asignada para esta entrega.');
    }

    db.prepare(
      `
      UPDATE revision
      SET respuestas_json = ?, nota_numerica = ?, comentario_extra = ?, fecha_envio = datetime('now')
      WHERE id = ?
    `
    ).run(respuestasJson ? JSON.stringify(respuestasJson) : null, notaNumerica, comentario || null, revision.id);

    const updated = db
      .prepare(
        `
        SELECT id, id_entrega, id_revisores, fecha_asignacion, fecha_envio, respuestas_json, nota_numerica, comentario_extra
        FROM revision
        WHERE id = ?
      `
      )
      .get(revision.id);

    res.json({
      id: updated.id,
      id_entrega: updated.id_entrega,
      id_revisores: updated.id_revisores,
      fecha_asignacion: updated.fecha_asignacion,
      fecha_envio: updated.fecha_envio,
      respuestas: updated.respuestas_json ? JSON.parse(updated.respuestas_json) : null,
      nota_numerica: updated.nota_numerica,
      comentario: updated.comentario_extra
    });
  } catch (error) {
    console.error('Error al guardar revisión:', error);
    return sendError(res, 500, 'No pudimos guardar la revisión.');
  }
});

router.post('/api/reviews/:reviewId/meta', requireAuth(['ADMIN', 'PROF']), (req, res) => {
  try {
    const reviewId = safeNumber(req.params.reviewId);
    if (!reviewId) {
      return sendError(res, 400, 'Identificador inválido.');
    }

    const revision = db
      .prepare(
        `
        SELECT rev.id, ent.id_tarea AS assignment_id, ent.id AS entrega_id
        FROM revision rev
        JOIN entregas ent ON ent.id = rev.id_entrega
        WHERE rev.id = ?
      `
      )
      .get(reviewId);

    if (!revision) {
      return sendError(res, 404, 'La revisión no existe.');
    }

    const notaCalidad = req.body?.nota_calidad !== undefined ? Number(req.body.nota_calidad) : null;
    const observacion = (req.body?.observacion || '').trim();

    const existing = db.prepare('SELECT id FROM meta_revision WHERE id_revision = ?').get(reviewId);

    if (existing) {
      db.prepare(
        `
        UPDATE meta_revision
        SET nota_calidad = ?, observacion = ?, fecha_registro = datetime('now')
        WHERE id = ?
      `
      ).run(notaCalidad, observacion || null, existing.id);
    } else {
      db.prepare(
        `
        INSERT INTO meta_revision (id_tarea, id_entrega, id_revision, id_profesor, nota_calidad, observacion)
        VALUES (?, ?, ?, ?, ?, ?)
      `
      ).run(revision.assignment_id, revision.entrega_id, reviewId, req.user.id, notaCalidad, observacion || null);
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Error al registrar meta-revisión:', error);
    return sendError(res, 500, 'No pudimos registrar la meta-revisión.');
  }
});

module.exports = router;
