const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// Inicializa la base de datos SQLite y aplica el schema al arrancar.
const dbPath = path.join(__dirname, 'data.sqlite');
const db = new Database(dbPath);

const schemaPath = path.join(__dirname, 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');
db.exec(schema);

module.exports = db;
