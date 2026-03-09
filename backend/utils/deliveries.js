const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const { spawn } = require("child_process");
const { splitIpynbFile } = require("./ipynbSplit");

const fsp = fs.promises;

const DELIVERIES_ROOT = path.join(__dirname, "..", "deliveries");
const CONTENT_DIRNAME = "contenido";
const BATCHES_DIRNAME = "lotes";
const TEMP_DIRNAME = "tmp";

ensureDir(DELIVERIES_ROOT);

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

/**
 * Normaliza nombres de archivo para evitar caracteres no permitidos en rutas.
 */
function sanitizeName(name = "") {
  return (
    name
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
      .replace(/\s+/g, "-")
      .toLowerCase()
      .trim() || "entrega.zip"
  );
}

function assignmentFolder(assignmentId) {
  return path.join(DELIVERIES_ROOT, String(assignmentId));
}

function teamFolder(assignmentId, teamId) {
  return path.join(assignmentFolder(assignmentId), String(teamId));
}

function contentFolder(assignmentId, teamId) {
  return path.join(teamFolder(assignmentId, teamId), CONTENT_DIRNAME);
}

function normalizeAbsolutePath(filePath = "") {
  const resolved = path.resolve(filePath);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

async function moveFile(tempPath, destination) {
  await ensureParent(destination);
  await fsp.rename(tempPath, destination);
}

async function ensureParent(filePath) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
}

async function clearDirectory(dirPath) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await fsp.rm(dirPath, { recursive: true, force: true });
      break;
    } catch (error) {
      if (error.code === "ENOTEMPTY" && attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        continue;
      }
      throw error;
    }
  }
  await fsp.mkdir(dirPath, { recursive: true });
}

/**
 * Persiste el ZIP subido por un equipo y devuelve metadata de almacenamiento.
 */
async function persistUploadedZip(
  tempPath,
  assignmentId,
  teamId,
  originalName
) {
  const baseFolder = teamFolder(assignmentId, teamId);
  await fsp.mkdir(baseFolder, { recursive: true });

  const timestamp = new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, "")
    .slice(0, 14);
  const safeName = sanitizeName(originalName);
  const storedName = `${timestamp}-${safeName}`;
  const destination = path.join(baseFolder, storedName);

  await moveFile(tempPath, destination);

  return {
    storedName,
    absolutePath: destination,
    relativePath: path
      .relative(path.join(__dirname, ".."), destination)
      .replace(/\\/g, "/"),
  };
}

/**
 * Persiste un ZIP de carga masiva asociado a una tarea.
 */
async function persistAssignmentZip(tempPath, assignmentId, originalName) {
  const baseFolder = path.join(assignmentFolder(assignmentId), BATCHES_DIRNAME);
  await fsp.mkdir(baseFolder, { recursive: true });
  const timestamp = new Date()
    .toISOString() // "2025-01-18T06:23:45.123Z"
    .replace(/[-:.TZ]/g, "")
    .slice(0, 14);
  const safeName = sanitizeName(originalName);
  const storedName = `${timestamp}-${safeName}`;
  const destination = path.join(baseFolder, storedName);

  await moveFile(tempPath, destination);

  return {
    storedName,
    absolutePath: destination,
    relativePath: path
      .relative(path.join(__dirname, ".."), destination)
      .replace(/\\/g, "/"),
  };
}

async function extractWithTar(zipPath, targetDir) {
  await fsp.mkdir(targetDir, { recursive: true });

  await new Promise((resolve, reject) => {
    const child = spawn("tar", ["-xf", zipPath, "-C", targetDir], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`tar exited with code ${code}${stderr ? `: ${stderr.trim()}` : ""}`));
    });
  });
}

async function unzipFile(zipPath, targetDir) {
  await fsp.mkdir(targetDir, { recursive: true });

  try {
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(targetDir, true);
    return;
  } catch (admError) {
    console.warn(
      `[deliveries] adm-zip falló con ${zipPath}: ${admError?.message || admError}. Intentando plan alternativo con tar.`
    );
  }

  try {
    await extractWithTar(zipPath, targetDir);
  } catch (tarError) {
    throw new Error(
      `No se pudo descomprimir ZIP ${zipPath}. adm-zip y tar fallaron: ${tarError?.message || tarError}`
    );
  }
}

/**
 * Crea un ZIP con todo el contenido de un directorio.
 */
async function createZipFromDirectory(sourceDir, destinationZipPath) {
  await ensureParent(destinationZipPath);
  const zip = new AdmZip();
  zip.addLocalFolder(sourceDir);
  zip.writeZip(destinationZipPath);
  return destinationZipPath;
}

async function expandNestedZips(dirPath) {
  const entries = await fsp.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      await expandNestedZips(fullPath);
      continue;
    }

    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".zip")) {
      continue;
    }

    const targetDir = fullPath.replace(/\.zip$/i, "");

    const exists = await fsp
      .access(fullPath, fs.constants.F_OK)
      .then(() => true)
      .catch(() => false);

    if (!exists) {
      console.warn(`[deliveries] ZIP anidado desapareció antes de procesarse: ${fullPath}`);
      continue;
    }

    await fsp.mkdir(targetDir, { recursive: true });

    try {
      await unzipFile(fullPath, targetDir);
    } catch (error) {
      console.warn(
        `[deliveries] No se pudo descomprimir ZIP anidado ${fullPath}: ${error?.message || error}`
      );
      await fsp.rm(targetDir, { recursive: true, force: true }).catch(() => {});
      continue;
    }

    await fsp.unlink(fullPath).catch(() => {});
    await expandNestedZips(targetDir);
  }
}

async function findIpynbFiles(rootDir) {
  const notebooks = [];

  async function walk(currentDir) {
    const entries = await fsp.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.endsWith("__split")) {
          continue;
        }
        await walk(fullPath);
        continue;
      }

      if (entry.isFile() && entry.name.toLowerCase().endsWith(".ipynb")) {
        notebooks.push(fullPath);
      }
    }
  }

  await walk(rootDir);
  return notebooks;
}

async function splitNotebooksInDirectory(rootDir) {
  const notebooks = await findIpynbFiles(rootDir);
  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (const notebookPath of notebooks) {
    const parsed = path.parse(notebookPath);
    const outputDir = path.join(parsed.dir, `${parsed.name}__split`);

    try {
      const result = await splitIpynbFile(notebookPath, outputDir);
      if (result.skipped) {
        skipped += 1;
      } else {
        processed += 1;
      }
    } catch (error) {
      failed += 1;
      console.warn(
        `[deliveries] No se pudo dividir notebook ${notebookPath}: ${error?.message || error}`
      );
    }
  }

  if (notebooks.length > 0) {
    console.info(
      `[deliveries] Split notebooks: total=${notebooks.length}, procesados=${processed}, omitidos=${skipped}, fallidos=${failed}`
    );
  }
}

async function cleanupOldZipFiles(dirPath, keepAbsolutePath = "") {
  try {
    const entries = await fsp.readdir(dirPath, { withFileTypes: true });
    const keepNormalized = keepAbsolutePath
      ? normalizeAbsolutePath(keepAbsolutePath)
      : "";

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".zip")) {
        continue;
      }
      const candidate = path.join(dirPath, entry.name);
      if (keepNormalized && normalizeAbsolutePath(candidate) === keepNormalized) {
        continue;
      }
      await fsp.unlink(candidate).catch(() => {});
    }
  } catch (_error) {
    // Si el directorio no existe o no se puede leer
  }
}

async function cleanupTeamZipHistory(assignmentId, teamId, keepAbsolutePath = "") {
  const dirPath = teamFolder(assignmentId, teamId);
  await cleanupOldZipFiles(dirPath, keepAbsolutePath);
}

async function cleanupBatchZipHistory(assignmentId, keepAbsolutePath = "") {
  const dirPath = path.join(assignmentFolder(assignmentId), BATCHES_DIRNAME);
  await cleanupOldZipFiles(dirPath, keepAbsolutePath);
}

/**
 * Extrae una entrega y prepara su contenido navegable (incluye ZIP anidados y notebooks).
 */
async function extractSubmission(assignmentId, teamId, zipAbsolutePath) {
  const targetDir = contentFolder(assignmentId, teamId);
  await clearDirectory(targetDir);
  await unzipFile(zipAbsolutePath, targetDir);
  await expandNestedZips(targetDir);
  await splitNotebooksInDirectory(targetDir);
  return targetDir;
}

/**
 * Recorre recursivamente un directorio y devuelve su lista de archivos relativos.
 */
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
      const relative = path.relative(baseDir, fullPath).replace(/\\/g, "/");
      results.push({
        path: relative,
        size: stats.size,
      });
    }
  }

  await walk(baseDir);
  return results.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Resuelve una ruta solicitada y verifica que permanezca dentro de baseDir.
 */
function ensureInside(baseDir, requestedPath) {
  const resolved = path.resolve(baseDir, requestedPath);
  if (!resolved.startsWith(path.resolve(baseDir))) {
    throw new Error("Ruta fuera de la entrega.");
  }
  return resolved;
}

module.exports = {
  DELIVERIES_ROOT,
  CONTENT_DIRNAME,
  assignmentFolder,
  teamFolder,
  contentFolder,
  persistUploadedZip,
  persistAssignmentZip,
  extractSubmission,
  listAllFiles,
  ensureInside,
  unzipFile,
  createZipFromDirectory,
  clearDirectory,
  cleanupTeamZipHistory,
  cleanupBatchZipHistory,
  TEMP_DIRNAME,
};
