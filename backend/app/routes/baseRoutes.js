const express = require('express');

const router = express.Router();

/**
 * Flujo: raiz del servicio -> endpoint publico de estado general.
 */
router.get('/', (_req, res) => {
  res.json({ status: 'Peer Review API ready' });
});

/**
 * Flujo: monitor o balanceador consulta salud -> backend responde disponibilidad.
 */
router.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

module.exports = router;
