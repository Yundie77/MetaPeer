const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

const { seedDatabase } = require('./seed');
const baseRoutes = require('./util/routes/baseRoutes');
const authRoutes = require('./util/routes/authRoutes');
const subjectsRoutes = require('./util/routes/subjectsRoutes');
const adminRoutes = require('./util/routes/adminRoutes');
const assignmentsRoutes = require('./util/routes/assignmentsRoutes');
const submissionsRoutes = require('./util/routes/submissionsRoutes');
const reviewsRoutes = require('./util/routes/reviewsRoutes');
const exportRoutes = require('./util/routes/exportRoutes');

dotenv.config({ path: path.join(__dirname, '.env') });
seedDatabase();

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
  next();
});

app.use(baseRoutes);
app.use(authRoutes);
app.use(subjectsRoutes);
app.use(adminRoutes);
app.use(assignmentsRoutes);
app.use(submissionsRoutes);
app.use(reviewsRoutes);
app.use(exportRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada.' });
});

app.use((err, _req, res, _next) => {
  console.error('Error inesperado:', err);
  res.status(500).json({ error: 'Ocurrió un error inesperado.' });
});

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => {
  console.log(`Peer review backend listening on port ${PORT}`);
});

module.exports = app;
