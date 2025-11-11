const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const fsp = fs.promises;

const DELIVERIES_ROOT = path.join(__dirname, '..', 'deliveries');
const CONTENT_DIRNAME = 'contenido';

ensureDir(DELIVERIES_ROOT);

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function sanitizeName(name = '') {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .trim() || 'entrega.zip';
}

function teamFolder(assignmentId, teamId) {
  return path.join(DELIVERIES_ROOT, String(assignmentId), String(teamId));
}

function contentFolder(assignmentId, teamId) {
  return path.join(teamFolder(assignmentId, teamId), CONTENT_DIRNAME);
}

async function moveFile(tempPath, destination) {
  await ensureParent(destination);
  await fsp.rename(tempPath, destination);
}

async function ensureParent(filePath) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
}

async function clearDirectory(dirPath) {
  await fsp.rm(dirPath, { recursive: true, force: true });
  await fsp.mkdir(dirPath, { recursive: true });
}

async function persistUploadedZip(tempPath, assignmentId, teamId, originalName) {
  const baseFolder = teamFolder(assignmentId, teamId);
  await fsp.mkdir(baseFolder, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const safeName = sanitizeName(originalName);
  const storedName = `${timestamp}-${safeName}`;
  const destination = path.join(baseFolder, storedName);

  await moveFile(tempPath, destination);

  return {
    storedName,
    absolutePath: destination,
    relativePath: path.relative(path.join(__dirname, '..'), destination).replace(/\\/g, '/')
  };
}

async function unzipFile(zipPath, targetDir) {
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(targetDir, true);
}

async function expandNestedZips(dirPath) {
  const entries = await fsp.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      await expandNestedZips(fullPath);
      continue;
    }

    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.zip')) {
      continue;
    }

    const targetDir = fullPath.replace(/\.zip$/i, '');
    await fsp.mkdir(targetDir, { recursive: true });
    await unzipFile(fullPath, targetDir);
    await fsp.unlink(fullPath);
    await expandNestedZips(targetDir);
  }
}

async function extractSubmission(assignmentId, teamId, zipAbsolutePath) {
  const targetDir = contentFolder(assignmentId, teamId);
  await clearDirectory(targetDir);
  await unzipFile(zipAbsolutePath, targetDir);
  await expandNestedZips(targetDir);
  return targetDir;
}

async function listAllFiles(baseDir) {
  const results = [];
  async function walk(current) {
    const entries = await fsp.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;
      const stats = await fsp.stat(fullPath);
      const relative = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      results.push({
        path: relative,
        size: stats.size
      });
    }
  }

  await walk(baseDir);
  return results.sort((a, b) => a.path.localeCompare(b.path));
}

function ensureInside(baseDir, requestedPath) {
  const resolved = path.resolve(baseDir, requestedPath);
  if (!resolved.startsWith(path.resolve(baseDir))) {
    throw new Error('Ruta fuera de la entrega.');
  }
  return resolved;
}

module.exports = {
  DELIVERIES_ROOT,
  CONTENT_DIRNAME,
  teamFolder,
  contentFolder,
  persistUploadedZip,
  extractSubmission,
  listAllFiles,
  ensureInside
};
