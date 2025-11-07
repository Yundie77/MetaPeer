const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { db } = require('./db');

// Clave JWT. En producción debe venir de las variables de entorno.
const JWT_SECRET = process.env.JWT_SECRET || 'demo-secret-key';
const JWT_EXPIRES_IN = '12h';

/**
 * Genera un token firmado a partir de la información básica del usuario.
 */
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      rol: user.rol
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Busca el usuario en la base de datos y confirma la contraseña.
 */
function verifyCredentials(email, password) {
  if (!email || !password) {
    return null;
  }

  const user = db.prepare(`
    SELECT id, correo, nombre_completo, rol, contrasena_hash
    FROM usuario
    WHERE correo = ?
  `).get(email);

  if (!user) {
    return null;
  }

  const isValid = user.contrasena_hash && bcrypt.compareSync(password, user.contrasena_hash);
  if (!isValid) {
    return null;
  }

  return {
    id: user.id,
    correo: user.correo,
    nombre_completo: user.nombre_completo,
    rol: user.rol
  };
}

/**
 * Middleware para validar JWT y, opcionalmente, restringir por rol.
 */
function requireAuth(allowedRoles = []) {
  return (req, res, next) => {
    try {
      const header = req.header('Authorization') || '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : null;

      if (!token) {
        return res.status(401).json({ error: 'Token faltante.' });
      }

      const payload = jwt.verify(token, JWT_SECRET);

      const user = db.prepare(`
        SELECT id, correo, nombre_completo, rol
        FROM usuario
        WHERE id = ?
      `).get(payload.id);

      if (!user) {
        return res.status(401).json({ error: 'Token inválido.' });
      }

      if (Array.isArray(allowedRoles) && allowedRoles.length > 0 && !allowedRoles.includes(user.rol)) {
        return res.status(403).json({ error: 'No tienes permiso para esta acción.' });
      }

      req.user = {
        id: user.id,
        email: user.correo,
        nombre: user.nombre_completo,
        rol: user.rol
      };

      next();
    } catch (error) {
      return res.status(401).json({ error: 'No pudimos validar tus credenciales.' });
    }
  };
}

module.exports = {
  generateToken,
  verifyCredentials,
  requireAuth
};
