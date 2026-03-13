function normalizeId(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
}

function removeUndefinedEntries(obj = {}) {
  const output = {};
  Object.entries(obj).forEach(([key, value]) => {
    if (value !== undefined) {
      output[key] = value;
    }
  });
  return output;
}

/**
 * Emite una traza de negocio estructurada (JSON por línea).
 * Campos comunes obligatorios:
 * ts, event, action, user_id, user_nombre, user_rol, assignment_id, submission_id, review_id, status.
 */
function logBusinessEvent({
  event,
  action,
  status = 'ok',
  user = null,
  assignmentId = null,
  submissionId = null,
  reviewId = null,
  data = {}
} = {}) {
  const payload = {
    ts: new Date().toISOString(),
    event: String(event || 'business_event'),
    action: String(action || 'unknown'),
    user_id: normalizeId(user?.id),
    user_nombre: user?.nombre || null,
    user_rol: user?.rol || null,
    assignment_id: normalizeId(assignmentId),
    submission_id: normalizeId(submissionId),
    review_id: normalizeId(reviewId),
    status: String(status || 'ok'),
    ...removeUndefinedEntries(data)
  };

  console.log(JSON.stringify(payload));
}

module.exports = {
  logBusinessEvent
};
