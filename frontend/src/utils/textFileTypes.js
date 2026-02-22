export const TEXT_EXTENSIONS = [
  '.js', '.jsx', '.ts', '.tsx',
  '.py', '.java', '.c', '.cpp', '.cs', '.rb', '.php', '.go', '.rs', '.swift', '.kt', '.m', '.scala',
  '.html', '.css', '.json', '.md', '.txt', '.csv', '.xml', '.yml', '.yaml'
];

export function isTextFile(filename = '') {
  const name = String(filename).toLowerCase();
  return TEXT_EXTENSIONS.some((ext) => name.endsWith(ext));
}

