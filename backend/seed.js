const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { applySchema, db } = require('./db');
const { generateReadablePassword } = require('./utils/passwords');

// Usuarios iniciales que ayudan a probar el MVP rápidamente.
// Usamos contraseñas sencillas porque el objetivo es mostrar el flujo completo.
const DEFAULT_USERS = [
  {
    correo: 'admin@demo',
    nombre: 'Admin Demo',
    rol: 'ADMIN',
    password: 'admin123'
  },
  {
    correo: 'prof@demo',
    nombre: 'Profesor Demo',
    rol: 'PROF',
    password: 'prof123'
  },
  {
    correo: 'alum@demo',
    nombre: 'Alumno Demo',
    rol: 'ALUM',
    password: 'alum123'
  }
];

const PRODUCTION_BOOTSTRAP_ADMIN_EMAIL = 'admin@ucm';
const PRODUCTION_BOOTSTRAP_ADMIN_NAME = 'Administrador UCM';
const BOOTSTRAP_ADMIN_FILENAME = 'pass-admin.txt';

function parseBooleanEnv(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return null;
}

function isProductionEnvironment() {
  return String(process.env.NODE_ENV || '').toLowerCase() === 'production';
}

function shouldSeedDemoUsers() {
  if (isProductionEnvironment()) {
    return false;
  }

  const explicitFlag = parseBooleanEnv(process.env.SEED_DEMO_USERS);
  if (explicitFlag !== null) {
    return explicitFlag;
  }

  return true;
}

function buildBootstrapAdminReport({ email, password }) {
  const issuedAt = new Date().toISOString();
  return [
    'MetaPeer admin (solo primer arranque sin admins)',
    `issued_at=${issuedAt}`,
    `email=${email}`,
    `password=${password}`,
    '',
    'IMPORTANTE: elimina este archivo tras iniciar sesion por seguridad.'
  ].join('\n');
}

function writeBootstrapAdminReport({ email, password }) {
  const tmpDir = path.join(__dirname, 'tmp');
  fs.mkdirSync(tmpDir, { recursive: true });
  const reportPath = path.join(tmpDir, BOOTSTRAP_ADMIN_FILENAME);
  fs.writeFileSync(reportPath, buildBootstrapAdminReport({ email, password }), {
    encoding: 'utf8',
    mode: 0o600
  });
  return reportPath;
}

function ensureProductionBootstrapAdmin() {
  if (!isProductionEnvironment()) {
    return { created: false, email: '', password: '', reportPath: '' };
  }

  const adminCount = db.prepare(`SELECT COUNT(*) AS total FROM usuario WHERE rol = 'ADMIN'`).get()?.total || 0;
  if (adminCount > 0) {
    return { created: false, email: '', password: '', reportPath: '' };
  }

  const password = generateReadablePassword(10);
  const hash = bcrypt.hashSync(password, 10);
  db.prepare(
    `
    INSERT INTO usuario (correo, nombre_completo, rol, contrasena_hash, estado, creado_en)
    VALUES (?, ?, 'ADMIN', ?, 'activo', ?)
  `
  ).run(PRODUCTION_BOOTSTRAP_ADMIN_EMAIL, PRODUCTION_BOOTSTRAP_ADMIN_NAME, hash, new Date().toISOString());

  const reportPath = writeBootstrapAdminReport({
    email: PRODUCTION_BOOTSTRAP_ADMIN_EMAIL,
    password
  });

  return {
    created: true,
    email: PRODUCTION_BOOTSTRAP_ADMIN_EMAIL,
    password,
    reportPath
  };
}

/**
 * Crea las tablas (si aún no existen) y genera usuarios base para probar la app.
 */
function seedDatabase() {
  applySchema();

  const bootstrapAdmin = ensureProductionBootstrapAdmin();

  const demoUsersEnabled = shouldSeedDemoUsers();
  if (!demoUsersEnabled) {
    return { createdUsers: 0, demoUsersEnabled, bootstrapAdmin };
  }

  const existing = new Set(
    db.prepare('SELECT correo FROM usuario').all().map((row) => row.correo)
  );

  let createdUsers = 0;
  const insertUser = db.prepare(`
    INSERT INTO usuario (correo, nombre_completo, rol, contrasena_hash, estado, creado_en)
    VALUES (@correo, @nombre, @rol, @contrasena_hash, 'activo', @creado_en)
  `);

  const transaction = db.transaction(() => {
    DEFAULT_USERS.forEach((user) => {
      if (existing.has(user.correo)) {
        return;
      }
      const contrasena_hash = bcrypt.hashSync(user.password, 10);
      insertUser.run({
        correo: user.correo,
        nombre: user.nombre,
        rol: user.rol,
        contrasena_hash,
        creado_en: new Date().toISOString()
      });
      createdUsers += 1;
    });
  });

  transaction();
  return { createdUsers, demoUsersEnabled, bootstrapAdmin };
}

if (require.main === module) {
  try {
    const result = seedDatabase();
    if (result.bootstrapAdmin?.created) {
      console.log('Bootstrap admin de produccion creado.');
      console.log(`Email: ${result.bootstrapAdmin.email}`);
      console.log(`Password temporal: ${result.bootstrapAdmin.password}`);
      console.log(`Archivo local: ${result.bootstrapAdmin.reportPath}`);
      console.log('IMPORTANTE: guarda la credencial y elimina el archivo local despues del primer acceso por seguridad.');
    }

    if (!result.demoUsersEnabled) {
      console.log('Seed completado. Usuarios demo deshabilitados para este entorno.');
    } else {
      console.log(`Seed completado. Usuarios demo creados: ${result.createdUsers}`);
    }
  } catch (error) {
    console.error('Error al ejecutar el seed:', error);
    process.exit(1);
  }
}

module.exports = {
  seedDatabase
};
