// Helpers simples para construir y leer permalinks (?path=...&line=N)

export function buildPermalink({ path, line, revisionId }) {
  const { origin, pathname } = window.location;
  const params = new URLSearchParams();
  const normalizedRevision = Number(revisionId) || null;
  if (normalizedRevision) {
    params.set('revision', String(normalizedRevision));
  }
  if (path) params.set('path', path);
  const normalizedLine = Number(line) || 0;
  if (normalizedLine > 0) params.set('line', String(normalizedLine));
  const query = params.toString();
  return `${origin}${pathname}${query ? `?${query}` : ''}`;
}

export function readFromURL() {
  const params = new URLSearchParams(window.location.search);
  const path = params.get('path') || '';
  const line = Number(params.get('line') || '0') || 0;
  const revisionParam = params.get('revision');
  const revisionId = revisionParam ? Number(revisionParam) || null : null;
  return { path, line, revisionId };
}

export function writeToURL({ path, line, revisionId }) {
  const url = buildPermalink({ path, line, revisionId });
  window.history.replaceState(null, '', url);
}
