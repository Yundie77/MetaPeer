const express = require('express');
const fs = require('fs');
const path = require('path');
const { requireAuth } = require('../../auth');
const { db } = require('../../db');
const {persistUploadedZip, extractSubmission, persistAssignmentZip, 
  assignmentFolder, unzipFile, clearDirectory, TEMP_DIRNAME
} = require('../../utils/deliveries');
const { sendError, safeNumber, ensureAssignmentExists, ensureSubmissionAccess } = require('../helpers');
const { WORKSPACE_ROOT, BACKEND_ROOT } = require('../constants');
const { uploadZip } = require('../upload');

const fsp = fs.promises;

const router = express.Router();

/**
 * Normaliza un texto a minúsculas alfanuméricas para comparar nombres de equipo.
 */
function normalizeLabel(text = '') {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Extrae códigos tipo ABC123 y los devuelve en formato normalizado.
 */
function canonicalCode(text = '') {
  const match = text.match(/([a-zA-Z]+)(\d+)/);
  if (!match) return null;
  const letters = match[1].toLowerCase();
  const digits = Number(match[2]);
  if (!Number.isFinite(digits)) return null;
  return `${letters}${digits}`;
}

/**
 * Construye un conversor que mapea nombres/códigos de carpeta a id de equipo.
 */
function buildTeamResolver(assignmentId) {
  const knownTeams = db
    .prepare(
      `
      SELECT id, nombre
      FROM equipo
      WHERE id_tarea = ?
    `
    )
    .all(assignmentId);

  const codeMap = new Map();
  const normalizedMap = new Map();

  knownTeams.forEach((team) => {
    const teamName = team.nombre || '';
    const normalized = normalizeLabel(teamName);
    if (normalized && !normalizedMap.has(normalized)) {
      normalizedMap.set(normalized, team.id);
    }

    const regex = /[a-zA-Z]+0*\d+/g;
    let match;
    while ((match = regex.exec(teamName)) !== null) {
      const code = canonicalCode(match[0]);
      if (code && !codeMap.has(code)) {
        codeMap.set(code, team.id);
      }
    }

    const firstToken = (teamName.split(/[^a-z0-9]+/i).find(Boolean) || '').trim();
    const tokenCode = canonicalCode(firstToken);
    if (tokenCode && !codeMap.has(tokenCode)) {
      codeMap.set(tokenCode, team.id);
    }
  });

  return (folderName) => {
    const primaryToken = (folderName.split('_')[0] || folderName).trim();
    const codeCandidate = canonicalCode(primaryToken) || canonicalCode(folderName);
    if (codeCandidate && codeMap.has(codeCandidate)) {
      return codeMap.get(codeCandidate);
    }

    const normalized = normalizeLabel(primaryToken);
    if (normalized && normalizedMap.has(normalized)) {
      return normalizedMap.get(normalized);
    }

    const normalizedFull = normalizeLabel(folderName);
    if (normalizedFull && normalizedMap.has(normalizedFull)) {
      return normalizedMap.get(normalizedFull);
    }

    return null;
  };
}

/**
 * Recorre recursivamente el directorio descomprimido para localizar zips por equipo.
 */
async function findTeamArchives(rootDir) {
  const queue = [rootDir];
  const results = [];

  while (queue.length > 0) {
    const current = queue.shift();
    const entries = await fsp.readdir(current, { withFileTypes: true });
    const zipEntries = entries.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.zip'));

    if (zipEntries.length > 0) {
      results.push({
        folderName: path.basename(current),
        zipPaths: zipEntries.map((entry) => path.join(current, entry.name))
      });
      continue;
    }

    entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('__MACOSX'))
      .forEach((dir) => queue.push(path.join(current, dir.name)));
  }

  return results;
}

/**
 * Procesa los zips encontrados: resuelve equipo, guarda zip y registra/actualiza la entrega.
 */
async function processTeamArchives({ assignmentId, uploaderId, archives }) {
  const resolveTeam = buildTeamResolver(assignmentId);
  const processed = [];

  for (const archive of archives) {
    if (!archive.zipPaths || archive.zipPaths.length === 0) {
      continue;
    }

    const teamId = resolveTeam(archive.folderName);
    if (!teamId) {
      console.warn(`No se encontró equipo para carpeta ${archive.folderName}`);
      continue;
    }
    const mainZipPath = archive.zipPaths[0];
    const originalName = path.basename(mainZipPath) || 'entrega.zip';
    const stored = await persistUploadedZip(mainZipPath, assignmentId, teamId, originalName);
    const stats = await fsp.stat(stored.absolutePath).catch(() => null);
    await extractSubmission(assignmentId, teamId, stored.absolutePath);

    db.prepare(
      `
      INSERT INTO entregas (id_tarea, id_equipo, id_subidor, nombre_zip, ruta_archivo, tamano_bytes)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id_tarea, id_equipo) DO UPDATE SET
        id_subidor = excluded.id_subidor,
        nombre_zip = excluded.nombre_zip,
        ruta_archivo = excluded.ruta_archivo,
        tamano_bytes = excluded.tamano_bytes,
        fecha_subida = datetime('now')
    `
    ).run(assignmentId, teamId, uploaderId, originalName, stored.relativePath, stats ? stats.size : null);

    processed.push({
      teamId,
      zipName: originalName
    });
  }

  return processed;
}

/**
 * Sube un lote de entregas en ZIP, las descomprime y registra cada entrega.
 */
router.post('/api/submissions/upload-zip', requireAuth(['ADMIN', 'PROF']), uploadZip.single('zipFile'), async (req, res) => {
  let tempPathToClean = '';
  let extractionDir = '';

  try {
    const assignmentId = safeNumber(req.body?.assignmentId);
    if (!assignmentId) {
      return sendError(res, 400, 'Debes indicar la tarea.');
    }

    const assignment = ensureAssignmentExists(assignmentId);
    if (!assignment) {
      return sendError(res, 404, 'La tarea no existe.');
    }

    if (!req.file) {
      return sendError(res, 400, 'Selecciona un ZIP con las entregas.');
    }

    const originalName = req.file.originalname || 'entregas.zip';
    tempPathToClean = req.file.path;

    if (!originalName.toLowerCase().endsWith('.zip')) {
      return sendError(res, 400, 'El archivo debe tener extensión .zip.');
    }

    const storedBatch = await persistAssignmentZip(req.file.path, assignmentId, originalName);
    tempPathToClean = '';

    extractionDir = path.join(assignmentFolder(assignmentId), TEMP_DIRNAME, storedBatch.storedName.replace(/\.zip$/i, ''));
    await clearDirectory(extractionDir);
    await unzipFile(storedBatch.absolutePath, extractionDir);

    const archives = await findTeamArchives(extractionDir);
    if (archives.length === 0) {
      return sendError(res, 400, 'No encontramos archivos ZIP de equipos dentro del paquete.');
    }

    const processed = await processTeamArchives({
      assignmentId,
      uploaderId: req.user.id,
      archives
    });

    if (processed.length === 0) {
      return sendError(res, 400, 'No se procesaron entregas del ZIP.');
    }

    db.prepare(
      `
      INSERT INTO carga_entregas (id_tarea, id_profesor, nombre_zip, ruta_zip, total_equipos)
      VALUES (?, ?, ?, ?, ?)
    `
    ).run(assignmentId, req.user.id, originalName, storedBatch.relativePath, processed.length);

    return res.status(201).json({
      ok: true,
      assignmentId,
      totalEquipos: processed.length,
      equipos: processed,
      carga: {
        fecha: new Date().toISOString(),
        nombre_zip: originalName
      }
    });
  } catch (error) {
    console.error('Error al cargar ZIP de entregas:', error);
    return sendError(res, 500, 'No pudimos registrar las entregas del ZIP.');
  } finally {
    if (tempPathToClean) {
      fsp.unlink(tempPathToClean).catch(() => {});
    }
    if (extractionDir) {
      fsp.rm(extractionDir, { recursive: true, force: true }).catch(() => {});
    }
  }
});

/**
 * Lista las entregas de una tarea; para alumnos filtra solo sus equipos.
 */
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
                 eq.nombre AS equipo_nombre,
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
                 eq.nombre AS equipo_nombre,
                 u.nombre_completo AS autor_nombre,
                 u.correo AS autor_correo
          FROM entregas e
          JOIN equipo eq ON eq.id = e.id_equipo
          LEFT JOIN usuario u ON u.id = e.id_subidor
          WHERE e.id_tarea = ?
          ORDER BY e.fecha_subida DESC
        `
        )
        .all(assignmentId);
    }

    const lastBatch = db
      .prepare(
        `
        SELECT nombre_zip,
               ruta_zip,
               total_equipos,
               fecha_subida
        FROM carga_entregas
        WHERE id_tarea = ?
        ORDER BY fecha_subida DESC
        LIMIT 1
      `
      )
      .get(assignmentId);

    const totalEntregas = db
      .prepare(
        `
        SELECT COUNT(*) AS total
        FROM entregas
        WHERE id_tarea = ?
      `
      )
      .get(assignmentId)?.total;

    res.json({
      submissions: rows,
      meta: {
        ultimaCarga: lastBatch || null,
        totalEntregas: totalEntregas || 0
      }
    });
  } catch (error) {
    console.error('Error al listar entregas:', error);
    return sendError(res, 500, 'No pudimos listar las entregas.');
  }
});

/**
 * Permite descargar el ZIP de una entrega concreta si el usuario tiene permiso.
 */
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
