export function normalizePath(path = '') {
  return path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
}

export function ancestors(path = '') {
  const clean = normalizePath(path);
  if (!clean) return [];
  const parts = clean.split('/').filter(Boolean);
  const result = [];
  let current = '';
  parts.slice(0, -1).forEach((part) => {
    current = current ? `${current}/${part}` : part;
    result.push(current);
  });
  return result;
}

export function collectDirPaths(paths = []) {
  const dirs = new Set();
  paths.forEach((pathValue) => {
    ancestors(pathValue).forEach((dir) => dirs.add(dir));
  });
  return dirs;
}

export function buildTreeFromPaths(paths = []) {
  const root = new Map();

  const ensureNode = (level, name, fullPath) => {
    if (!level.has(name)) {
      level.set(name, { name, path: fullPath, isFile: false, children: new Map() });
    }
    return level.get(name);
  };

  paths.forEach((raw) => {
    const clean = normalizePath(raw);
    const parts = clean.split('/').filter(Boolean);
    if (!parts.length) return;

    let level = root;
    let acc = '';
    parts.forEach((part, idx) => {
      const isLast = idx === parts.length - 1;
      acc = acc ? `${acc}/${part}` : part;
      const node = ensureNode(level, part, acc);
      if (isLast) {
        node.isFile = true;
      }
      level = node.children;
    });
  });

  const toArray = (level) =>
    Array.from(level.values())
      .sort((a, b) => (a.isFile === b.isFile ? a.name.localeCompare(b.name) : a.isFile ? 1 : -1))
      .map((node) => ({ ...node, children: toArray(node.children) }));

  return toArray(root);
}
