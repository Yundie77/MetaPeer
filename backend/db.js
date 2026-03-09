const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// Definimos rutas absolutas para evitar errores cuando se ejecuta desde otros directorios.
const DB_FILE = path.join(__dirname, 'data.sqlite');
const SCHEMA_FILE = path.join(__dirname, 'schema.sql');

// Abrimos la base de datos una sola vez y compartimos la conexión.
// Activamos WAL para que SQLite soporte mejor escrituras concurrentes.
const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * Aplica el esquema SQL completo sobre la base actual.
 */
function applySchema() {
  const schemaText = fs.readFileSync(SCHEMA_FILE, 'utf8');
  db.exec(schemaText);
}

/**
 * Ejecuta una sentencia SQL de escritura.
 */
function run(sql, params = {}) {
  return db.prepare(sql).run(params);
}

/**
 * Ejecuta una consulta SQL y devuelve la primera fila.
 */
function get(sql, params = {}) {
  return db.prepare(sql).get(params);
}

/**
 * Ejecuta una consulta SQL y devuelve todas las filas.
 */
function all(sql, params = {}) {
  return db.prepare(sql).all(params);
}

/**
 * Ejecuta una unidad de trabajo dentro de una transacción SQLite.
 */
function transaction(work) {
  const wrapped = db.transaction(work);
  return wrapped(db);
}

// Aplicamos el esquema inmediatamente para garantizar que las tablas existen.
applySchema();

module.exports = {
  db,
  applySchema,
  run,
  get,
  all,
  transaction
};
