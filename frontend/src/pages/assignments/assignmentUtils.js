/**
 * Indica si una tarea tiene asignación iniciada/bloqueada.
 */
export function isAssignmentBlocked(assignment) {
  return Boolean(assignment?.asignacion_bloqueada) || (assignment?.asignacion_total_revisiones ?? 0) > 0;
}

/**
 * Separa un texto de rúbrica en etiqueta y detalle.
 */
export function splitLabelDetail(texto = '') {
  const parts = String(texto ?? '').split('||DETAIL||');
  return {
    label: parts[0] || '',
    detail: parts.slice(1).join('||DETAIL||') || ''
  };
}

/**
 * Une etiqueta y detalle al formato esperado por backend.
 */
export function combineLabelDetail(label, detail) {
  const safeLabel = label || '';
  const safeDetail = detail || '';
  return safeDetail ? `${safeLabel}||DETAIL||${safeDetail}` : safeLabel;
}

/**
 * Devuelve el siguiente modo de orden por fecha.
 */
export function getNextDueSortMode(mode) {
  return mode === 'default' ? 'asc' : mode === 'asc' ? 'desc' : 'default';
}

/**
 * Devuelve el title del botón de orden por fecha.
 */
export function getDueSortTitle(mode) {
  if (mode === 'asc') {
    return 'Orden ascendente por fecha de entrega';
  }
  if (mode === 'desc') {
    return 'Orden descendente por fecha de entrega';
  }
  return 'Orden original por id';
}

/**
 * Ordena tareas por fecha de entrega manteniendo fallback de fechas inválidas.
 */
export function sortAssignmentsByDue(assignments = [], dueSortMode = 'default') {
  if (dueSortMode === 'default') {
    return assignments;
  }
  const direction = dueSortMode === 'asc' ? 1 : -1;
  const withFallback = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.getTime();
  };
  return [...assignments].sort((a, b) => {
    const aTime = withFallback(a.fecha_entrega);
    const bTime = withFallback(b.fecha_entrega);
    if (aTime === null && bTime === null) return 0;
    if (aTime === null) return 1;
    if (bTime === null) return -1;
    return (aTime - bTime) * direction;
  });
}

