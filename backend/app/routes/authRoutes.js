const express = require('express');
const { generateToken, verifyCredentials, requireAuth } = require('../../auth');
const { sendError, logBusinessEvent } = require('../helpers');

const router = express.Router();

function isProductionEnvironment() {
  return String(process.env.NODE_ENV || '').toLowerCase() === 'production';
}

function isDemoEmail(email) {
  return String(email || '').trim().toLowerCase().endsWith('@demo');
}

/**
 * Flujo: pantalla de login -> cliente envia credenciales -> backend valida y devuelve JWT.
 */
router.post('/api/login', (req, res) => {
  try {
    const { email, password } = req.body || {};
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!normalizedEmail || !password) {
      logBusinessEvent({
        event: 'login_failed',
        action: 'login',
        status: 'error',
        data: {
          email_normalized: normalizedEmail || null,
          reason: 'missing_credentials'
        }
      });
      return sendError(res, 400, 'Email y contraseña son obligatorios.');
    }

    if (isProductionEnvironment() && isDemoEmail(normalizedEmail)) {
      logBusinessEvent({
        event: 'login_failed',
        action: 'login',
        status: 'error',
        data: {
          email_normalized: normalizedEmail,
          reason: 'demo_account_blocked_in_production'
        }
      });
      return sendError(res, 401, 'Credenciales inválidas.');
    }

    const user = verifyCredentials(normalizedEmail, password);
    if (!user) {
      logBusinessEvent({
        event: 'login_failed',
        action: 'login',
        status: 'error',
        data: {
          email_normalized: normalizedEmail,
          reason: 'invalid_credentials'
        }
      });
      return sendError(res, 401, 'Credenciales inválidas.');
    }

    const token = generateToken(user);
    logBusinessEvent({
      event: 'login_success',
      action: 'login',
      status: 'ok',
      user: {
        id: user.id,
        nombre: user.nombre_completo,
        rol: user.rol
      }
    });
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
    logBusinessEvent({
      event: 'login_failed',
      action: 'login',
      status: 'error',
      data: {
        reason: 'unexpected_error'
      }
    });
    return sendError(res, 500, 'No pudimos procesar el inicio de sesión.');
  }
});

/**
 * Flujo: cliente ya autenticado envia Bearer token -> backend devuelve perfil basico de sesion.
 */
router.get('/api/me', requireAuth(), (req, res) => {
  res.json({
    id: req.user.id,
    nombre: req.user.nombre,
    email: req.user.email,
    rol: req.user.rol
  });
});

module.exports = router;
