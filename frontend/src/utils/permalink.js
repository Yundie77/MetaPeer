// Helpers simples para construir y leer permalinks (?path=...&line=N o ?file=...&line=N)

export function buildPermalink({ path, line, revisionId, fileId, useRevisionId = false }) {
  const { origin, pathname } = window.location;
  const params = new URLSearchParams();
  const normalizedRevision = Number(revisionId) || null;

  if (normalizedRevision) {
    params.set(useRevisionId ? 'revisionId' : 'revision', String(normalizedRevision));
  }

  const normalizedFileId = (fileId || '').toString().trim();
  if (normalizedFileId) {
    params.set('file', normalizedFileId);
  } else if (path) {
    params.set('path', path);
  }

  const normalizedLine = Number(line) || 0;
  if (normalizedLine > 0) params.set('line', String(normalizedLine));
  const query = params.toString();

  return `${origin}${pathname}${query ? `?${query}` : ''}`;
}

export function readFromURL() {
  const params = new URLSearchParams(window.location.search);
  const fileId = (params.get('file') || params.get('fileId') || '').trim();
  const path = params.get('path') || '';
  const line = Number(params.get('line') || '0') || 0;
  const revisionParam = params.get('revision') || params.get('revisionId');
  const revisionId = revisionParam ? Number(revisionParam) || null : null;
  
  return { fileId, path, line, revisionId };
}

export function writeToURL({ path, line, revisionId, fileId, useRevisionId = false }) {
  const url = buildPermalink({ path, line, revisionId, fileId, useRevisionId });
  window.history.replaceState(null, '', url);
}
