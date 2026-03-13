const express = require('express');
const fs = require('fs');
const fsp = fs.promises;
const { requireAuth } = require('../../../auth');
const { db } = require('../../../db');
const { contentFolder, ensureInside, listAllFiles } = require('../../../utils/deliveries');
const { findFileById, normalizeRelativePath } = require('../../../utils/reviewFileIds');
const { fileHash } = require('../../../utils/fileHash');
const { sendError, safeNumber, ensureRevisionPermission, escapeHtml, logBusinessEvent } = require('../../helpers');

const router = express.Router();
const REVIEW_COMMENT_MAX_LENGTH = 5000;

/**
 * Flujo: visor de codigo de revision -> alumno publica comentario por linea de archivo.
 */
router.post('/api/reviews/:revisionId/comments', requireAuth(['ALUM']), async (req, res) => {
  let revisionIdForLog = null;
  let assignmentIdForLog = null;
  let submissionIdForLog = null;
  let filePathRelForLog = null;
  let lineForLog = null;

  try {
    const revisionId = safeNumber(req.params.revisionId);
    revisionIdForLog = revisionId;
    const fileId = (req.body?.fileId || req.body?.file || '').toString().trim();
    const linea = safeNumber(req.body?.line || req.body?.linea);
    lineForLog = linea;
    const contenidoRaw = req.body?.contenido ?? req.body?.text ?? '';

    if (contenidoRaw !== null && contenidoRaw !== undefined && typeof contenidoRaw !== 'string') {
      return sendError(res, 400, 'El comentario debe ser texto.');
    }

    const contenido = String(contenidoRaw).trim();

    if (!revisionId || !fileId) {
      return sendError(res, 400, 'Falta indicar el archivo.');
    }
    if (!linea || linea <= 0) {
      return sendError(res, 400, 'La línea indicada no es válida.');
    }
    if (!contenido) {
      return sendError(res, 400, 'El comentario no puede estar vacío.');
    }
    if (contenido.length > REVIEW_COMMENT_MAX_LENGTH) {
      return sendError(res, 400, `El comentario no puede superar ${REVIEW_COMMENT_MAX_LENGTH} caracteres.`);
    }

    const escapedContenido = escapeHtml(contenido);

    const revision = ensureRevisionPermission(revisionId, req.user, { allowOwners: true });
    if (!revision) {
      return sendError(res, 403, 'No puedes comentar este archivo.');
    }
    assignmentIdForLog = revision.assignment_id;
    submissionIdForLog = revision.submission_id;

    const baseDir = contentFolder(revision.assignment_id, revision.author_team_id);
    if (!fs.existsSync(baseDir)) {
      return sendError(res, 404, 'No encontramos los archivos de la entrega.');
    }

    const files = await listAllFiles(baseDir);
    const target = findFileById(files, revisionId, fileId);
    if (!target) {
      return sendError(res, 404, 'No encontramos el archivo indicado.');
    }

    const relativePath = normalizeRelativePath(target.path);
    filePathRelForLog = relativePath.replace(/\\/g, '/');
    const absolutePath = ensureInside(baseDir, relativePath);
    const stats = await fsp.stat(absolutePath);
    if (!stats.isFile()) {
      return sendError(res, 400, 'Solo puedes comentar archivos.');
    }

    const sha1 = await fileHash(absolutePath, 'sha1');

    const createdAt = new Date().toISOString();
    const insert = db
      .prepare(
        `
        INSERT INTO code_comment (revision_id, sha1, ruta_archivo, linea, contenido, autor_id, creado_en)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `
      )
      .run(revisionId, sha1, filePathRelForLog, linea, escapedContenido, req.user.id, createdAt);

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

    logBusinessEvent({
      event: 'line_comment_created',
      action: 'create_line_comment',
      status: 'ok',
      user: req.user,
      assignmentId: revision.assignment_id,
      submissionId: revision.submission_id,
      reviewId: revisionId,
      data: {
        line: linea,
        file_path_rel: filePathRelForLog
      }
    });

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
    logBusinessEvent({
      event: 'line_comment_created',
      action: 'create_line_comment',
      status: 'error',
      user: req.user,
      assignmentId: assignmentIdForLog,
      submissionId: submissionIdForLog,
      reviewId: revisionIdForLog,
      data: {
        line: lineForLog,
        file_path_rel: filePathRelForLog,
        reason: 'unexpected_error'
      }
    });
    return sendError(res, 500, 'No pudimos guardar el comentario.');
  }
});

/**
 * Flujo: abrir archivo en workspace de revision -> cliente consulta comentario general del archivo.
 */
router.get('/api/reviews/:revisionId/file-comments', requireAuth(), async (req, res) => {
  try {
    const revisionId = safeNumber(req.params.revisionId);
    const fileId = (req.query?.fileId || req.query?.file || '').toString().trim();

    if (!revisionId || !fileId) {
      return sendError(res, 400, 'Falta indicar el archivo.');
    }

    const revision = ensureRevisionPermission(revisionId, req.user, { allowOwners: true });
    if (!revision) {
      return sendError(res, 403, 'No puedes ver los comentarios de este archivo.');
    }

    const baseDir = contentFolder(revision.assignment_id, revision.author_team_id);
    if (!fs.existsSync(baseDir)) {
      return sendError(res, 404, 'No encontramos los archivos de la entrega.');
    }

    const files = await listAllFiles(baseDir);
    const target = findFileById(files, revisionId, fileId);
    if (!target) {
      return sendError(res, 404, 'No encontramos el archivo indicado.');
    }

    const relativePath = normalizeRelativePath(target.path);
    const absolutePath = ensureInside(baseDir, relativePath);
    const stats = await fsp.stat(absolutePath);
    if (!stats.isFile()) {
      return sendError(res, 400, 'Solo puedes comentar archivos.');
    }

    const sha1 = await fileHash(absolutePath, 'sha1');
    const normalizedPath = relativePath.replace(/\\/g, '/');

    const rows = db
      .prepare(
        `
        SELECT fc.id,
               fc.contenido,
               fc.creado_en,
               usr.nombre_completo AS autor_nombre,
               usr.correo          AS autor_correo
        FROM file_comment fc
        LEFT JOIN usuario usr ON usr.id = fc.autor_id
        WHERE fc.revision_id = ?
          AND fc.sha1 = ?
          AND fc.ruta_archivo = ?
        ORDER BY fc.id
      `
      )
      .all(revisionId, sha1, normalizedPath);

    const comments = rows.map((row) => ({
      id: row.id,
      contenido: row.contenido,
      creado_en: row.creado_en,
      autor: row.autor_nombre ? { nombre: row.autor_nombre, correo: row.autor_correo } : null,
      sha1
    }));

    return res.json(comments);
  } catch (error) {
    console.error('Error al cargar comentarios generales:', error);
    return sendError(res, 500, 'No pudimos cargar los comentarios.');
  }
});

/**
 * Flujo: panel de revision -> alumno crea/actualiza comentario general del archivo activo.
 */
router.post('/api/reviews/:revisionId/file-comments', requireAuth(['ALUM']), async (req, res) => {
  let revisionIdForLog = null;
  let assignmentIdForLog = null;
  let submissionIdForLog = null;
  let filePathRelForLog = null;

  try {
    const revisionId = safeNumber(req.params.revisionId);
    revisionIdForLog = revisionId;
    const fileId = (req.body?.fileId || req.body?.file || '').toString().trim();
    const contenidoRaw = req.body?.contenido ?? req.body?.text ?? '';

    if (contenidoRaw !== null && contenidoRaw !== undefined && typeof contenidoRaw !== 'string') {
      return sendError(res, 400, 'El comentario debe ser texto.');
    }

    const contenido = String(contenidoRaw).trim();

    if (!revisionId || !fileId) {
      return sendError(res, 400, 'Falta indicar el archivo.');
    }
    if (!contenido) {
      return sendError(res, 400, 'El comentario no puede estar vacío.');
    }
    if (contenido.length > REVIEW_COMMENT_MAX_LENGTH) {
      return sendError(res, 400, `El comentario no puede superar ${REVIEW_COMMENT_MAX_LENGTH} caracteres.`);
    }

    const escapedContenido = escapeHtml(contenido);

    const revision = ensureRevisionPermission(revisionId, req.user, { allowOwners: true });
    if (!revision) {
      return sendError(res, 403, 'No puedes comentar este archivo.');
    }
    assignmentIdForLog = revision.assignment_id;
    submissionIdForLog = revision.submission_id;

    const baseDir = contentFolder(revision.assignment_id, revision.author_team_id);
    if (!fs.existsSync(baseDir)) {
      return sendError(res, 404, 'No encontramos los archivos de la entrega.');
    }

    const files = await listAllFiles(baseDir);
    const target = findFileById(files, revisionId, fileId);
    if (!target) {
      return sendError(res, 404, 'No encontramos el archivo indicado.');
    }

    const relativePath = normalizeRelativePath(target.path);
    const absolutePath = ensureInside(baseDir, relativePath);
    const stats = await fsp.stat(absolutePath);
    if (!stats.isFile()) {
      return sendError(res, 400, 'Solo puedes comentar archivos.');
    }

    const sha1 = await fileHash(absolutePath, 'sha1');
    const normalizedPath = relativePath.replace(/\\/g, '/');
    filePathRelForLog = normalizedPath;

    const existing = db
      .prepare(
        `
        SELECT id
        FROM file_comment
        WHERE revision_id = ?
          AND sha1 = ?
          AND ruta_archivo = ?
      `
      )
      .get(revisionId, sha1, normalizedPath);

    let commentId = null;
    let updated = false;

    const createdAt = new Date().toISOString();
    if (existing?.id) {
      db.prepare(
        `
        UPDATE file_comment
        SET contenido = ?,
            autor_id = ?,
            creado_en = ?
        WHERE id = ?
      `
      ).run(escapedContenido, req.user.id, createdAt, existing.id);
      commentId = existing.id;
      updated = true;
    } else {
      const insert = db
        .prepare(
          `
          INSERT INTO file_comment (revision_id, sha1, ruta_archivo, contenido, autor_id, creado_en)
          VALUES (?, ?, ?, ?, ?, ?)
        `
        )
        .run(revisionId, sha1, normalizedPath, escapedContenido, req.user.id, createdAt);
      commentId = insert.lastInsertRowid;
    }

    const created = db
      .prepare(
        `
        SELECT fc.id,
               fc.contenido,
               fc.creado_en,
               usr.nombre_completo AS autor_nombre,
               usr.correo          AS autor_correo
        FROM file_comment fc
        LEFT JOIN usuario usr ON usr.id = fc.autor_id
        WHERE fc.id = ?
      `
      )
      .get(commentId);

    logBusinessEvent({
      event: updated ? 'file_comment_updated' : 'file_comment_created',
      action: updated ? 'update_file_comment' : 'create_file_comment',
      status: 'ok',
      user: req.user,
      assignmentId: revision.assignment_id,
      submissionId: revision.submission_id,
      reviewId: revisionId,
      data: {
        file_path_rel: normalizedPath
      }
    });

    return res.status(updated ? 200 : 201).json({
      id: created.id,
      contenido: created.contenido,
      creado_en: created.creado_en,
      autor: created.autor_nombre ? { nombre: created.autor_nombre, correo: created.autor_correo } : null,
      sha1
    });
  } catch (error) {
    console.error('Error al guardar comentario general:', error);
    logBusinessEvent({
      event: 'file_comment_created',
      action: 'create_or_update_file_comment',
      status: 'error',
      user: req.user,
      assignmentId: assignmentIdForLog,
      submissionId: submissionIdForLog,
      reviewId: revisionIdForLog,
      data: {
        file_path_rel: filePathRelForLog,
        reason: 'unexpected_error'
      }
    });
    return sendError(res, 500, 'No pudimos guardar el comentario.');
  }
});

module.exports = router;
