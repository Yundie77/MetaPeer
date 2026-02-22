/**
 * Convierte textos como "Dirección de correo" en llaves amigables "direccion_correo".
 * Esto simplifica el acceso a las columnas desde JavaScript.
 */
function normalizeHeader(header) {
  return header
    .toLowerCase()
    .normalize("NFD") // Separa acentos.
    .replace(/[\u0300-\u036f]/g, "") // Quita marcas diacríticas.
    .replace(/[^a-z0-9]+/g, "_") // Cambia todo lo que no sea alfanumérico por guiones bajos.
    .replace(/^_+|_+$/g, ""); // Elimina guiones bajos al inicio/fin.
}

/**
 * Normaliza valores de texto para comparaciones sencillas:
 * - recorta espacios
 * - pasa a minúsculas
 * - quita acentos
 * - reemplaza grupos de espacios por guiones bajos
 */
function toLowercaseIdentifier(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");
}

/**
 * Separa una línea CSV respetando comas dentro de comillas.
 */
function splitCsvLine(line) {
  const cells = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      // Dos comillas seguidas representan una comilla escapada.
      if (insideQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1; // Saltamos el siguiente carácter porque ya lo consumimos.
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}

/**
 * Convierte un texto CSV a un arreglo de objetos usando la primera fila como encabezado.
 * Si el CSV está vacío devolvemos un arreglo vacío para simplificar el flujo en las rutas.
 */
function parseCsvToObjects(csvText) {
  if (!csvText || !csvText.trim()) {
    return [];
  }

  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return [];
  }

  const headers = splitCsvLine(lines[0]).map((header) =>
    normalizeHeader(header)
  );
  const rows = [];

  for (let i = 1; i < lines.length; i += 1) {
    const values = splitCsvLine(lines[i]);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ? values[index].trim() : "";
    });
    rows.push(row);
  }

  return rows;
}

module.exports = {
  normalizeHeader,
  toLowercaseIdentifier,
  splitCsvLine,
  parseCsvToObjects,
};
