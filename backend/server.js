const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

const db = require('./db');

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({ status: 'Peer Review API ready' });
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});


const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Peer review backend listening on port ${PORT}`);
});

