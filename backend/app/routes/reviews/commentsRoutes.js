const express = require('express');
const fs = require('fs');
const fsp = fs.promises;
const { requireAuth } = require('../../../auth');
const { db } = require('../../../db');
const { contentFolder, ensureInside, listAllFiles } = require('../../../utils/deliveries');
const { findFileById, normalizeRelativePath } = require('../../../utils/reviewFileIds');
const { fileHash } = require('../../../utils/fileHash');
const { sendError, safeNumber, ensureRevisionPermission } = require('../../helpers');

const router = express.Router();

router.post('/api/reviews/:revisionId/comments', requireAuth(['ALUM']), async (req, res) => {
  try {
    const revisionId = safeNumber(req.params.revisionId);
    const fileId = (req.body?.fileId || req.body?.file || '').toString().trim();
    const linea = safeNumber(req.body?.line || req.body?.linea);
    const contenido = (req.body?.contenido || req.body?.text || '').toString().trim();

    if (!revisionId || !fileId) {
      return sendError(res, 400, 'Falta indicar el archivo.');
    }
    if (!linea || linea <= 0) {
      return sendError(res, 400, 'La línea indicada no es válida.');
    }
    if (!contenido) {
      return sendError(res, 400, 'El comentario no puede estar vacío.');
    }

    const revision = ensureRevisionPermission(revisionId, req.user, { allowOwners: true });
    if (!revision) {
      return sendError(res, 403, 'No puedes comentar este archivo.');
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

module.exports = router;
