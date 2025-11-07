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

// Esta función aplica el SQL del esquema completo.
function applySchema() {
  const schemaText = fs.readFileSync(SCHEMA_FILE, 'utf8');
  db.exec(schemaText);
}

// Helpers sencillos para ejecutar consultas. Hacen el resto del código más claro.
function run(sql, params = {}) {
  return db.prepare(sql).run(params);
}

function get(sql, params = {}) {
  return db.prepare(sql).get(params);
}

function all(sql, params = {}) {
  return db.prepare(sql).all(params);
}

// Permite ejecutar varias operaciones dentro de una transacción SQLite.
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
