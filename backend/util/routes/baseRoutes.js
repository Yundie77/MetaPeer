const express = require('express');

const router = express.Router();

router.get('/', (_req, res) => {
  res.json({ status: 'Peer Review API ready' });
});

router.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

module.exports = router;
