const { db } = require('../../db');
const {
  DEFAULT_RUBRIC_ITEM_KEY,
  DEFAULT_RUBRIC_ITEM_TEXT,
  DEFAULT_RUBRIC_ITEM_WEIGHT,
  RUBRIC_SCORE_MIN,
  RUBRIC_SCORE_MAX
} = require('../constants');
const { ensureAssignmentRecord } = require('./assignmentStore');

function ensureDefaultRubricForAssignment(assignmentId) {
  const assignmentRecordId = ensureAssignmentRecord(assignmentId);
  const existingCount = db
    .prepare(
      `
      SELECT COUNT(*) AS total
      FROM rubrica_items
      WHERE id_asignacion = ?
    `
    )
    .get(assignmentRecordId)?.total;

  if (Number(existingCount) > 0) {
    return assignmentRecordId;
  }

  db.prepare(
    `
    INSERT INTO rubrica_items (id_asignacion, clave_item, texto, peso)
    VALUES (?, ?, ?, ?)
  `
  ).run(
    assignmentRecordId,
    DEFAULT_RUBRIC_ITEM_KEY,
    DEFAULT_RUBRIC_ITEM_TEXT,
    DEFAULT_RUBRIC_ITEM_WEIGHT
  );

  return assignmentRecordId;
}

function fetchAssignmentRubric(assignmentId) {
  const assignmentRecordId = ensureDefaultRubricForAssignment(assignmentId);

  return db
    .prepare(
      `
      SELECT id, clave_item, texto, peso
      FROM rubrica_items
      WHERE id_asignacion = ?
      ORDER BY id ASC
    `
    )
    .all(assignmentRecordId);
}

/**
 * Valida respuestas de rubrica, normaliza puntuaciones y calcula la nota final ponderada.
 */
function calculateRubricScore(rubricItems, rawResponses) {
  if (!Array.isArray(rubricItems) || rubricItems.length === 0) {
    throw new Error('La rúbrica no está configurada para esta tarea.');
  }

  if (!rawResponses || typeof rawResponses !== 'object' || Array.isArray(rawResponses)) {
    throw new Error('Las respuestas de la rúbrica no son válidas.');
  }

  const expectedKeys = new Set(rubricItems.map((item) => item.clave_item));
  const normalizedScores = {};

  for (const [key, rawValue] of Object.entries(rawResponses)) {
    if (!expectedKeys.has(key) && rawValue !== '' && rawValue !== null && rawValue !== undefined) {
      throw new Error(`La clave de rúbrica (${key}) no existe para esta tarea.`);
    }
  }

  let total = 0;
  rubricItems.forEach((item) => {
    const rawValue = rawResponses[item.clave_item];
    if (rawValue === '' || rawValue === null || rawValue === undefined) {
      throw new Error(`Falta la nota del criterio "${item.texto}".`);
    }

    const value = Number(rawValue);
    if (!Number.isFinite(value)) {
      throw new Error(`La nota del criterio "${item.texto}" no es válida.`);
    }
    if (value < RUBRIC_SCORE_MIN || value > RUBRIC_SCORE_MAX) {
      throw new Error(
        `La nota del criterio "${item.texto}" debe estar entre ${RUBRIC_SCORE_MIN} y ${RUBRIC_SCORE_MAX}.`
      );
    }

    const weight = Number(item.peso) || 0;
    normalizedScores[item.clave_item] = value;
    total += value * (weight / 100);
  });

  const notaFinal = Number(total.toFixed(2));
  return {
    normalizedScores,
    notaFinal
  };
}

module.exports = {
  ensureDefaultRubricForAssignment,
  fetchAssignmentRubric,
  calculateRubricScore
};
