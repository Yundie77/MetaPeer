const crypto = require('crypto');

const FILE_ID_SECRET = process.env.FILE_ID_SECRET || process.env.JWT_SECRET || 'demo-secret-key';
const FILE_ID_VERSION = 'v1';

function normalizeRelativePath(pathValue = '') {
  return String(pathValue || '')
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '');
}

/**
 * Genera un ID único para un archivo basado en el ID de revisión y la ruta relativa
 */
function buildFileId(revisionId, relativePath) {
  const normalizedRevision = Number(revisionId) || 0;
  const cleanPath = normalizeRelativePath(relativePath);
  const hmac = crypto.createHmac('sha256', FILE_ID_SECRET);
  // El ID depende de v1 : revisiónId : ruta
  hmac.update(`${FILE_ID_VERSION}:${normalizedRevision}:${cleanPath}`);
  // Base64 URL-safe
  return hmac
    .digest('base64')
    .replace(/=+$/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Adjunta IDs únicos a una lista de archivos basada en el ID de revisión
 * { path: 'src/ejemplo1.pdf', size: 24, id: '13...' }
 */
function attachFileIds(files = [], revisionId) {
  return files.map((file) => ({
    ...file,
    id: buildFileId(revisionId, file.path)
  }));
}

function findFileById(files = [], revisionId, fileId) {
  const target = String(fileId || '').trim();
  if (!target) return null;
  for (const file of files) {
    // Recalculamos el ID y lo comparamos
    const id = buildFileId(revisionId, file.path);
    if (id === target) {
      return { ...file, id };
    }
  }
  return null;
}

module.exports = {
  normalizeRelativePath,
  buildFileId,
  attachFileIds,
  findFileById
};
