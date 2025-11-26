const express = require('express');
const fs = require('fs');
const fsp = fs.promises;
const { requireAuth } = require('../../../auth');
const { db } = require('../../../db');
const { listAllFiles, ensureInside, contentFolder } = require('../../../utils/deliveries');
const { fileHash } = require('../../../utils/fileHash');
const { sendError, safeNumber, ensureRevisionPermission, isLikelyBinary } = require('../../helpers');

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

module.exports = router;
