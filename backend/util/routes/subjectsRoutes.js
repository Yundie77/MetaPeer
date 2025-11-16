const express = require('express');
const { requireAuth } = require('../../auth');
const { db } = require('../../db');
const { sendError } = require('../helpers');

const router = express.Router();

router.post('/api/asignaturas', requireAuth(['ADMIN', 'PROF']), (req, res) => {
  try {
    const codigo = (req.body?.codigo || '').trim();
    const nombre = (req.body?.nombre || '').trim();

    if (!codigo || !nombre) {
      return sendError(res, 400, 'Código y nombre son obligatorios.');
    }

    const existing = db.prepare('SELECT id FROM asignatura WHERE codigo = ?').get(codigo);
    if (existing) {
      return sendError(res, 409, 'Ya existe una asignatura con ese código.');
    }

    const insert = db.prepare('INSERT INTO asignatura (codigo, nombre) VALUES (?, ?)').run(codigo, nombre);

    res.status(201).json({
      id: insert.lastInsertRowid,
      codigo,
      nombre
    });
  } catch (error) {
    console.error('Error al crear asignatura:', error);
    return sendError(res, 500, 'No pudimos crear la asignatura.');
  }
});

router.get('/api/asignaturas', requireAuth(['ADMIN', 'PROF']), (_req, res) => {
  try {
    const rows = db
      .prepare(
        `
        SELECT id, codigo, nombre
        FROM asignatura
        ORDER BY nombre
      `
      )
      .all();

    res.json(rows);
  } catch (error) {
    console.error('Error al listar asignaturas:', error);
    return sendError(res, 500, 'No pudimos listar las asignaturas.');
  }
});

module.exports = router;
