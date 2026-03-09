export function findBestPath(fileNames = [], requestedPath = '') {
  const normalizedTarget = (requestedPath || '').replace(/\\/g, '/').trim();
  if (!normalizedTarget) {
    return fileNames[0] || '';
  }

  if (fileNames.includes(normalizedTarget)) {
    return normalizedTarget;
  }

  const lowerTarget = normalizedTarget.toLowerCase();
  const lowerMatch = fileNames.find((name) => name.toLowerCase() === lowerTarget);
  if (lowerMatch) {
    return lowerMatch;
  }

  const targetParts = normalizedTarget.split('/');
  const lastSegment = targetParts[targetParts.length - 1] || '';
  if (!lastSegment) {
    return fileNames[0] || '';
  }
  const suffixMatch = fileNames.find((name) => name.toLowerCase().endsWith(lastSegment.toLowerCase()));
  return suffixMatch || fileNames[0] || '';
}
