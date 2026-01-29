const express = require('express');
const { requireAuth } = require('../../auth');
const { db } = require('../../db');
const { sendError } = require('../helpers');

const router = express.Router();

router.post('/api/asignaturas', requireAuth(['ADMIN', 'PROF']), (req, res) => {
  try {
    const nombre = (req.body?.nombre || '').trim();

    if (!nombre) {
      return sendError(res, 400, 'El nombre es obligatorio.');
    }

    const existing = db.prepare('SELECT id FROM asignatura WHERE nombre = ?').get(nombre);
    if (existing) {
      return sendError(res, 409, 'Ya existe una asignatura con ese nombre.');
    }

    const insert = db.prepare('INSERT INTO asignatura (nombre) VALUES (?)').run(nombre);

    res.status(201).json({
      id: insert.lastInsertRowid,
      nombre
    });
  } catch (error) {
    console.error('Error al crear asignatura:', error);
    return sendError(res, 500, 'No pudimos crear la asignatura.');
  }
});

router.get('/api/asignaturas', requireAuth(['ADMIN', 'PROF']), (req, res) => {
  try {
    const isProf = req.user?.rol === 'PROF';
    const rows = isProf
      ? db
          .prepare(
            `
            SELECT a.id, a.nombre
            FROM asignatura a
            JOIN usuario_asignatura ua ON ua.id_asignatura = a.id
            WHERE ua.id_usuario = ?
            ORDER BY a.nombre
          `
          )
          .all(req.user.id)
      : db
          .prepare(
            `
            SELECT id, nombre
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
