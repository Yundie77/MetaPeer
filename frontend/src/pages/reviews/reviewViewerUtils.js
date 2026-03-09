import { normalizePath } from '../../utils/fileTreeHelpers.js';
import { buildAlias, formatRelativeTime } from '../../utils/reviewCommentFormat.js';

const PREVIEWABLE_IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']);

/**
 * Extrae la extensión de un path de archivo en minúsculas.
 */
export function getFileExtension(pathValue) {
  if (!pathValue) return '';
  const lastDot = pathValue.lastIndexOf('.');
  if (lastDot === -1) return '';
  return pathValue.slice(lastDot + 1).toLowerCase();
}

/**
 * Determina el tipo de vista previa soportada para un archivo.
 */
export function getPreviewType(pathValue) {
  const ext = getFileExtension(pathValue);
  if (!ext) return '';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'html') return 'html';
  if (PREVIEWABLE_IMAGE_EXTENSIONS.has(ext)) return 'image';
  return '';
}

/**
 * Normaliza un mapa {path: count} conservando solo rutas válidas con conteos positivos.
 */
export function normalizeCountMap(rawCounts = {}) {
  const normalizedCounts = {};
  Object.entries(rawCounts).forEach(([pathValue, total]) => {
    const normalized = normalizePath(pathValue);
    const count = Number(total) || 0;
    if (normalized && count > 0) {
      normalizedCounts[normalized] = count;
    }
  });
  return normalizedCounts;
}

/**
 * Normaliza un mapa {path: line} conservando solo rutas válidas con líneas > 0.
 */
export function normalizeFirstLineMap(rawLines = {}) {
  const normalizedFirstLines = {};
  Object.entries(rawLines).forEach(([pathValue, lineValue]) => {
    const normalized = normalizePath(pathValue);
    const line = Number(lineValue) || 0;
    if (normalized && line > 0) {
      normalizedFirstLines[normalized] = line;
    }
  });
  return normalizedFirstLines;
}

/**
 * Obtiene la primera línea comentada válida dentro de una lista de comentarios.
 */
export function getFirstCommentLine(comments = []) {
  const firstLine = Array.isArray(comments)
    ? comments.reduce((min, comment) => {
        const line = Number(comment?.linea) || 0;
        if (line > 0 && line < min) return line;
        return min;
      }, Number.POSITIVE_INFINITY)
    : Number.POSITIVE_INFINITY;

  return Number.isFinite(firstLine) && firstLine > 0 ? firstLine : 0;
}

/**
 * Mapea comentarios de código a un índice por línea para el editor.
 */
export function buildCommentsByLine(comments = []) {
  const map = new Map();
  comments.forEach((comment) => {
    const lineNum = Number(comment.linea);
    if (!Number.isInteger(lineNum) || lineNum <= 0) return;
    const content = (comment.contenido ?? '').trim();
    if (!content) return;
    const list = map.get(lineNum) || [];
    const authorName = (comment.autor?.nombre ?? '').trim();
    const alias = buildAlias(authorName || 'Revisor');
    const { relativeText, absoluteText } = formatRelativeTime(comment.creado_en);
    list.push({
      id: comment.id,
      message: content,
      alias,
      aliasTitle: authorName || 'Revisor',
      timeText: relativeText,
      timeTitle: absoluteText
    });
    map.set(lineNum, list);
  });
  return map;
}

/**
 * Mapea comentarios generales de fichero a los ítems mostrados en UI.
 */
export function buildFileCommentItems(comments = []) {
  return comments
    .map((comment) => {
      const content = (comment.contenido ?? '').trim();
      if (!content) return null;
      const authorName = (comment.autor?.nombre ?? '').trim();
      const alias = buildAlias(authorName || 'Revisor');
      const { relativeText, absoluteText } = formatRelativeTime(comment.creado_en);
      return {
        id: comment.id,
        message: content,
        alias,
        aliasTitle: authorName || 'Revisor',
        timeText: relativeText,
        timeTitle: absoluteText
      };
    })
    .filter(Boolean);
}

