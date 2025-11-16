const express = require('express');
const fs = require('fs');
const path = require('path');
const { requireAuth } = require('../../auth');
const { db } = require('../../db');
const { persistUploadedZip, extractSubmission } = require('../../utils/deliveries');
const {
  sendError,
  safeNumber,
  ensureAssignmentExists,
  ensureUserTeam,
  ensureSubmissionAccess
} = require('../helpers');
const { WORKSPACE_ROOT, BACKEND_ROOT } = require('../constants');
const { uploadZip } = require('../upload');

const router = express.Router();

router.post('/api/submissions', requireAuth(['ALUM']), uploadZip.single('zipFile'), async (req, res) => {
  let tempPathToClean = '';
  try {
    const assignmentId = safeNumber(req.body?.assignmentId);
    const authorUserId = safeNumber(req.body?.authorUserId) || req.user.id;

    if (!assignmentId) {
      return sendError(res, 400, 'Debes indicar la tarea.');
    }

    if (authorUserId !== req.user.id) {
      return sendError(res, 403, 'Solo puedes registrar tus propias entregas.');
    }

    const assignment = ensureAssignmentExists(assignmentId);
    if (!assignment) {
      return sendError(res, 404, 'La tarea no existe.');
    }

    const teamId = ensureUserTeam(assignmentId, req.user.id);

    const existing = db
      .prepare(
        `
        SELECT id
        FROM entregas
        WHERE id_tarea = ? AND id_equipo = ?
      `
      )
      .get(assignmentId, teamId);

    if (existing) {
      return sendError(res, 409, 'Tu equipo ya registró esta entrega.');
    }

    if (!req.file) {
      return sendError(res, 400, 'Selecciona un archivo ZIP antes de subir.');
    }

    const originalName = req.file.originalname || 'entrega.zip';
    tempPathToClean = req.file.path;

    if (!originalName.toLowerCase().endsWith('.zip')) {
      return sendError(res, 400, 'El archivo debe tener extensión .zip.');
    }

    const stored = await persistUploadedZip(req.file.path, assignmentId, teamId, originalName);
    await extractSubmission(assignmentId, teamId, stored.absolutePath);

    const insert = db
      .prepare(
        `
        INSERT INTO entregas (id_tarea, id_equipo, id_subidor, nombre_zip, ruta_archivo, tamano_bytes)
        VALUES (?, ?, ?, ?, ?, ?)
      `
      )
      .run(assignmentId, teamId, req.user.id, originalName, stored.relativePath, req.file.size || null);

    const created = db
      .prepare(
        `
        SELECT id,
               id_tarea,
               id_equipo,
               id_subidor,
               nombre_zip,
               ruta_archivo,
               tamano_bytes,
               fecha_subida
        FROM entregas
        WHERE id = ?
      `
      )
      .get(insert.lastInsertRowid);

    return res.status(201).json(created);
  } catch (error) {
    console.error('Error al registrar entrega:', error);
    return sendError(res, 500, 'No pudimos registrar la entrega.');
  } finally {
    if (tempPathToClean) {
      fs.promises
        .unlink(tempPathToClean)
        .catch(() => {});
    }
  }
});

router.get('/api/submissions', requireAuth(), (req, res) => {
  try {
    const assignmentId = safeNumber(req.query.assignmentId);
    if (!assignmentId) {
      return sendError(res, 400, 'Debes indicar assignmentId.');
    }

    const assignment = ensureAssignmentExists(assignmentId);
    if (!assignment) {
      return sendError(res, 404, 'La tarea no existe.');
    }

    let rows = [];

    if (req.user.rol === 'ALUM') {
      rows = db
        .prepare(
          `
          SELECT e.id,
                 e.nombre_zip,
                 e.fecha_subida,
                 e.id_equipo,
                 e.id_subidor,
                 e.ruta_archivo,
                 e.tamano_bytes
          FROM entregas e
          JOIN equipo eq ON eq.id = e.id_equipo
          JOIN miembro_equipo me ON me.id_equipo = eq.id
          WHERE e.id_tarea = ? AND me.id_usuario = ?
          ORDER BY e.fecha_subida DESC
        `
        )
        .all(assignmentId, req.user.id);
    } else {
      rows = db
        .prepare(
          `
          SELECT e.id,
                 e.nombre_zip,
                 e.fecha_subida,
                 e.id_equipo,
                 e.id_subidor,
                 e.ruta_archivo,
                 e.tamano_bytes,
                 u.nombre_completo AS autor_nombre,
                 u.correo AS autor_correo
          FROM entregas e
          LEFT JOIN usuario u ON u.id = e.id_subidor
          WHERE e.id_tarea = ?
          ORDER BY e.fecha_subida DESC
        `
        )
        .all(assignmentId);
    }

    res.json(rows);
  } catch (error) {
    console.error('Error al listar entregas:', error);
    return sendError(res, 500, 'No pudimos listar las entregas.');
  }
});

router.get('/api/submissions/:submissionId/download', requireAuth(), (req, res) => {
  try {
    const submissionId = safeNumber(req.params.submissionId);
    if (!submissionId) {
      return sendError(res, 400, 'Identificador inválido.');
    }

    const submission = ensureSubmissionAccess(submissionId, req.user);
    if (!submission) {
      return sendError(res, 403, 'No puedes descargar esta entrega.');
    }

    if (!submission.zip_path) {
      return sendError(res, 404, 'Esta entrega no tiene archivo asociado.');
    }

    const pathCandidates = path.isAbsolute(submission.zip_path)
      ? [submission.zip_path]
      : [path.join(BACKEND_ROOT, submission.zip_path), path.join(WORKSPACE_ROOT, submission.zip_path)];
    const absolutePath = pathCandidates.find((candidate) => fs.existsSync(candidate));
    if (!absolutePath) {
      return sendError(res, 404, 'No encontramos el ZIP en el servidor.');
    }

    res.download(absolutePath, submission.zip_name || path.basename(absolutePath));
  } catch (error) {
    console.error('Error al descargar entrega:', error);
    return sendError(res, 500, 'No pudimos descargar la entrega.');
  }
});

module.exports = router;
