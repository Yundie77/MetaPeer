// Helpers simples para construir y leer permalinks (?path=...&line=N)

export function buildPermalink({ path, line }) {
  const { origin, pathname } = window.location;
  const params = new URLSearchParams();
  if (path) params.set('path', path);
  if (line && Number(line) > 0) params.set('line', String(line));
  const query = params.toString();
  return `${origin}${pathname}${query ? `?${query}` : ''}`;
}

export function readFromURL() {
  const params = new URLSearchParams(window.location.search);
  const path = params.get('path') || '';
  const line = Number(params.get('line') || '0') || 0;
  return { path, line };
}

export function writeToURL({ path, line }) {
  const url = buildPermalink({ path, line });
  window.history.replaceState(null, '', url);
}

