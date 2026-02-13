const express = require('express');
const fs = require('fs');
const path = require('path');
const fsp = fs.promises;
const { requireAuth } = require('../../../auth');
const { db } = require('../../../db');
const { listAllFiles, ensureInside, contentFolder } = require('../../../utils/deliveries');
const { attachFileIds, findFileById, normalizeRelativePath } = require('../../../utils/reviewFileIds');
const { fileHash } = require('../../../utils/fileHash');
const { sendError, safeNumber, ensureRevisionPermission, isLikelyBinary } = require('../../helpers');

const router = express.Router();

const PREVIEW_MIME_TYPES = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  html: 'text/html; charset=utf-8'
};

/**
 * Resuelve el tipo de contenido basado en la extensión del archivo
 */
function resolveContentType(filePath) {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  return PREVIEW_MIME_TYPES[ext] || 'application/octet-stream';
}

/**
 * Lista los archivos de una revisión específica
 */
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
    const commentRows = db
      .prepare(
        `
        SELECT ruta_archivo,
               COUNT(*) AS total
        FROM file_comment
        WHERE revision_id = ?
        GROUP BY ruta_archivo
      `
      )
      .all(revisionId);

    const fileCommentCounts = commentRows.reduce((acc, row) => {
      const normalized = normalizeRelativePath(row.ruta_archivo);
      const total = Number(row.total) || 0;
      if (normalized && total > 0) {
        acc[normalized] = total;
      }
      return acc;
    }, {});

    const codeCommentRows = db
      .prepare(
        `
        SELECT ruta_archivo,
               COUNT(*) AS total,
               MIN(linea) AS first_line
        FROM code_comment
        WHERE revision_id = ?
        GROUP BY ruta_archivo
      `
      )
      .all(revisionId);

    const codeCommentCounts = {};
    const codeCommentFirstLine = {};
    codeCommentRows.forEach((row) => {
      const normalized = normalizeRelativePath(row.ruta_archivo);
      const total = Number(row.total) || 0;
      if (normalized && total > 0) {
        codeCommentCounts[normalized] = total;
        const firstLine = Number(row.first_line) || 0;
        if (firstLine > 0) {
          codeCommentFirstLine[normalized] = firstLine;
        }
      }
    });

    return res.json({
      revisionId,
      submissionId: revision.submission_id,
      zipName: revision.zip_name,
      files: attachFileIds(files, revisionId),
      fileCommentCounts,
      codeCommentCounts,
      codeCommentFirstLine
    });
  } catch (error) {
    console.error('Error al listar archivos de revisión:', error);
    return sendError(res, 500, 'No pudimos cargar el árbol de archivos.');
  }
});

/**
 * Obtiene el contenido de un archivo específico dentro de una revisión
 */
router.get('/api/reviews/:revisionId/file', requireAuth(), async (req, res) => {
  try {
    const revisionId = safeNumber(req.params.revisionId);
    const fileId = (req.query.fileId || req.query.file || '').toString().trim();

    if (!revisionId || !fileId) {
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

    const files = await listAllFiles(baseDir);
    const target = findFileById(files, revisionId, fileId);
    if (!target) {
      return sendError(res, 404, 'No encontramos el archivo solicitado.');
    }

    const relativePath = normalizeRelativePath(target.path);
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
      id: target.id,
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

/**
 * Envía el archivo directamente para vista previa o descarga
 */
router.get('/api/reviews/:revisionId/file/raw', requireAuth(), async (req, res) => {
  try {
    const revisionId = safeNumber(req.params.revisionId);
    const fileId = (req.query.fileId || req.query.file || '').toString().trim();

    if (!revisionId || !fileId) {
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

    const files = await listAllFiles(baseDir);
    const target = findFileById(files, revisionId, fileId);
    if (!target) {
      return sendError(res, 404, 'No encontramos el archivo solicitado.');
    }

    const relativePath = normalizeRelativePath(target.path);
    const absolutePath = ensureInside(baseDir, relativePath);
    const stats = await fsp.stat(absolutePath);
    if (!stats.isFile()) {
      return sendError(res, 400, 'La ruta indicada no es un fichero.');
    }

    const contentType = resolveContentType(absolutePath);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(absolutePath)}"`);
    return res.sendFile(absolutePath);
  } catch (error) {
    console.error('Error al enviar archivo de revisión:', error);
    return sendError(res, 500, 'No pudimos abrir el archivo solicitado.');
  }
});

module.exports = router;
