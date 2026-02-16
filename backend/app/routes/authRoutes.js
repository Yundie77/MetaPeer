const express = require('express');
const { generateToken, verifyCredentials, requireAuth } = require('../../auth');
const { sendError } = require('../helpers');

const router = express.Router();

function isProductionEnvironment() {
  return String(process.env.NODE_ENV || '').toLowerCase() === 'production';
}

function isDemoEmail(email) {
  return String(email || '').trim().toLowerCase().endsWith('@demo');
}

router.post('/api/login', (req, res) => {
  try {
    const { email, password } = req.body || {};
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!normalizedEmail || !password) {
      return sendError(res, 400, 'Email y contraseña son obligatorios.');
    }

    if (isProductionEnvironment() && isDemoEmail(normalizedEmail)) {
      return sendError(res, 401, 'Credenciales inválidas.');
    }

    const user = verifyCredentials(normalizedEmail, password);
    if (!user) {
      return sendError(res, 401, 'Credenciales inválidas.');
    }

    const token = generateToken(user);
    return res.json({
      token,
      user: {
        id: user.id,
        nombre: user.nombre_completo,
        email: user.correo,
        rol: user.rol
      }
    });
  } catch (error) {
    console.error('Error en /api/login:', error);
    return sendError(res, 500, 'No pudimos procesar el inicio de sesión.');
  }
});

router.get('/api/me', requireAuth(), (req, res) => {
  res.json({
    id: req.user.id,
    nombre: req.user.nombre,
    email: req.user.email,
    rol: req.user.rol
  });
});

module.exports = router;
