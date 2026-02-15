const bcrypt = require('bcryptjs');
const { applySchema, db } = require('./db');

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

/**
 * Crea las tablas (si aún no existen) y genera usuarios base para probar la app.
 */
function seedDatabase() {
  applySchema();

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
  return { createdUsers };
}

if (require.main === module) {
  try {
    const result = seedDatabase();
    console.log(`Seed completado. Usuarios creados: ${result.createdUsers}`);
  } catch (error) {
    console.error('Error al ejecutar el seed:', error);
    process.exit(1);
  }
}

module.exports = {
  seedDatabase
};
