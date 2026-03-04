#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");

const fsp = fs.promises;

function printHelp() {
  const script = path.basename(process.argv[1]);
  console.log(`Usage: ${script} <notebook.ipynb> [output-dir]

Explodes a Jupyter Notebook (ipynb) into numbered section files, one per cell.

Arguments:
  <notebook.ipynb>  Path to the .ipynb file to split
  [output-dir]      Directory to write cell files (defaults to cwd)

Options:
  --dry-run         Parse input and report actions without writing files
`);
}

function toText(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => (entry == null ? "" : String(entry))).join("");
  }
  if (value == null) {
    return "";
  }
  return String(value);
}

function isRecord(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function normalizeBase64(value) {
  return String(value || "").replace(/\s+/g, "");
}

function decodeBase64Buffer(base64Value) {
  const normalized = normalizeBase64(base64Value);
  if (!normalized) {
    throw new Error("empty base64 payload");
  }

  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
    throw new Error("invalid base64 alphabet");
  }

  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  const buffer = Buffer.from(padded, "base64");
  if (!buffer.length) {
    throw new Error("decoded payload is empty");
  }

  const inputNoPadding = padded.replace(/=+$/g, "");
  const decodedNoPadding = buffer.toString("base64").replace(/=+$/g, "");
  if (decodedNoPadding !== inputNoPadding) {
    throw new Error("base64 validation failed");
  }

  return buffer;
}

function createPlotlyHtml(plotlyPayload) {
  const payload = plotlyPayload && typeof plotlyPayload === "object" ? plotlyPayload : {};
  const data = Array.isArray(payload.data) ? payload.data : [];
  const layout = payload.layout && typeof payload.layout === "object" ? payload.layout : {};
  const config = payload.config && typeof payload.config === "object" ? payload.config : { responsive: true };

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="https://cdn.plot.ly/plotly-3.3.0.min.js"></script>
  <title>Plotly Output</title>
</head>
<body style="margin:0;">
  <div id="plotly-root" style="width:100%;height:100vh;"></div>
  <script>
    const data = ${JSON.stringify(data)};
    const layout = ${JSON.stringify(layout)};
    const config = ${JSON.stringify(config)};
    Plotly.newPlot("plotly-root", data, layout, config);
  </script>
</body>
</html>`;
}

function sourceExtension(cellType) {
  return cellType === "code" ? "py" : "md";
}

function padIndex(value, minDigits) {
  return String(value).padStart(minDigits, "0");
}

function resolveOutputContent(output) {
  const safeOutput = isRecord(output) ? output : {};
  const data = isRecord(safeOutput.data) ? safeOutput.data : null;

  if (data && Object.prototype.hasOwnProperty.call(data, "image/png")) {
    try {
      const pngSource = toText(data["image/png"]);
      return {
        extension: "png",
        content: decodeBase64Buffer(pngSource),
        isBinary: true,
      };
    } catch (error) {
      console.warn(`Warning: failed to decode image/png output: ${error?.message || error}`);
      return {
        extension: "txt",
        content: JSON.stringify(output || {}, null, 2),
        isBinary: false,
      };
    }
  }

  if (data && Object.prototype.hasOwnProperty.call(data, "application/vnd.plotly.v1+json")) {
    return {
      extension: "html",
      content: createPlotlyHtml(data["application/vnd.plotly.v1+json"]),
      isBinary: false,
    };
  }

  if (data && Object.prototype.hasOwnProperty.call(data, "text/html")) {
    return {
      extension: "html",
      content: toText(data["text/html"]),
      isBinary: false,
    };
  }

  if (data && Object.prototype.hasOwnProperty.call(data, "text/plain")) {
    return {
      extension: "txt",
      content: toText(data["text/plain"]),
      isBinary: false,
    };
  }

  if (safeOutput.output_type === "stream") {
    return {
      extension: "txt",
      content: toText(safeOutput.text),
      isBinary: false,
    };
  }

  if (Array.isArray(safeOutput.traceback) && safeOutput.traceback.length > 0) {
    return {
      extension: "txt",
      content: safeOutput.traceback.join("\n"),
      isBinary: false,
    };
  }

  if (typeof safeOutput.text === "string" || Array.isArray(safeOutput.text)) {
    return {
      extension: "txt",
      content: toText(safeOutput.text),
      isBinary: false,
    };
  }

  return {
    extension: "txt",
    content: JSON.stringify(output || {}, null, 2),
    isBinary: false,
  };
}

async function isOutputUpToDate(outputDir, sourceStats) {
  try {
    const outputStats = await fsp.stat(outputDir);
    if (!outputStats.isDirectory()) {
      return false;
    }

    if (outputStats.mtimeMs < sourceStats.mtimeMs) {
      return false;
    }

    const entries = await fsp.readdir(outputDir, { withFileTypes: true });
    return entries.some((entry) => entry.isFile() && /^cell_\d+_/i.test(entry.name));
  } catch (_error) {
    return false;
  }
}

async function splitIpynbFile(inputPath, outputDir, { dryRun = false } = {}) {
  if (!inputPath || !outputDir) {
    throw new Error("Debes indicar inputPath y outputDir para splitIpynbFile.");
  }

  const resolvedInputPath = path.resolve(inputPath);
  const resolvedOutputDir = path.resolve(outputDir);
  const notebookRaw = await fsp.readFile(resolvedInputPath, "utf8");

  let notebook;
  try {
    notebook = JSON.parse(notebookRaw);
  } catch (_error) {
    throw new Error(`No se pudo parsear notebook: ${resolvedInputPath}`);
  }

  const sourceStats = await fsp.stat(resolvedInputPath);

  if (!dryRun && (await isOutputUpToDate(resolvedOutputDir, sourceStats))) {
    return {
      notebookPath: resolvedInputPath,
      outputDir: resolvedOutputDir,
      dryRun: false,
      skipped: true,
      files: [],
      cells: Array.isArray(notebook?.cells) ? notebook.cells.length : 0,
      filesWritten: 0,
    };
  }

  const cells = Array.isArray(notebook?.cells) ? notebook.cells : [];
  const cellDigits = Math.max(2, String(cells.length || 1).length);
  const filesToWrite = [];

  cells.forEach((cell, cellIndex) => {
    const cellNumber = cellIndex + 1;
    const cellLabel = padIndex(cellNumber, cellDigits);
    const cellType = cell?.cell_type || "markdown";
    const sourceFileName = `cell_${cellLabel}_src.${sourceExtension(cellType)}`;
    filesToWrite.push({
      name: sourceFileName,
      content: toText(cell?.source),
      isBinary: false,
    });

    if (cellType !== "code" || !Array.isArray(cell?.outputs) || cell.outputs.length === 0) {
      return;
    }

    cell.outputs.forEach((output, outputIndex) => {
      const outputLabel = padIndex(outputIndex + 1, 2);
      const resolvedOutput = resolveOutputContent(output);
      filesToWrite.push({
        name: `cell_${cellLabel}_output_${outputLabel}.${resolvedOutput.extension}`,
        content: resolvedOutput.content,
        isBinary: Boolean(resolvedOutput.isBinary),
      });
    });
  });

  if (dryRun) {
    return {
      notebookPath: resolvedInputPath,
      outputDir: resolvedOutputDir,
      dryRun: true,
      skipped: false,
      cells: cells.length,
      filesWritten: 0,
      files: filesToWrite.map((entry) => entry.name),
    };
  }

  await fsp.rm(resolvedOutputDir, { recursive: true, force: true });
  await fsp.mkdir(resolvedOutputDir, { recursive: true });

  for (const fileEntry of filesToWrite) {
    const destination = path.join(resolvedOutputDir, fileEntry.name);
    if (fileEntry.isBinary) {
      await fsp.writeFile(destination, fileEntry.content);
    } else {
      await fsp.writeFile(destination, toText(fileEntry.content), "utf8");
    }
  }

  return {
    notebookPath: resolvedInputPath,
    outputDir: resolvedOutputDir,
    dryRun: false,
    skipped: false,
    cells: cells.length,
    filesWritten: filesToWrite.length,
    files: filesToWrite.map((entry) => entry.name),
  };
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
    printHelp();
    process.exit(args.length === 0 ? 1 : 0);
  }

  const dryRun = args.includes("--dry-run");
  const positional = args.filter((arg) => arg !== "--dry-run");

  if (positional.length === 0) {
    console.error("Error: missing notebook path. Use --help for usage.");
    process.exit(1);
  }

  const inputPath = positional[0];
  const outputDir = positional[1] || process.cwd();

  const result = await splitIpynbFile(inputPath, outputDir, { dryRun });
  if (result.skipped) {
    console.log(`Skipped ${inputPath}: split output is up-to-date.`);
    return;
  }

  if (dryRun) {
    result.files.forEach((fileName) => {
      console.log(`[Dry Run] Would write ${path.join(outputDir, fileName)}`);
    });
    return;
  }

  result.files.forEach((fileName) => {
    console.log(`Wrote ${path.join(outputDir, fileName)}`);
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error?.message || error);
    process.exit(1);
  });
}

module.exports = {
  splitIpynbFile,
};
