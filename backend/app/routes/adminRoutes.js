const express = require('express');
const bcrypt = require('bcryptjs');
const { requireAuth } = require('../../auth');
const { db } = require('../../db');
const { parseCsvToObjects, toLowercaseIdentifier } = require('../../utils/csv');
const {
  sendError,
  safeNumber,
  ensureRosterAssignment,
  cloneRosterTeamsToAssignment,
  getProfessorSubjects
} = require('../helpers');
const { DEFAULT_PROFESSOR_PASSWORD, ROSTER_PREFIX } = require('../constants');

const router = express.Router();

router.post('/api/admin/import-roster', requireAuth(['ADMIN', 'PROF']), (req, res) => {
  try {
    const csvText = req.body?.csvText;
    const asignaturaId = safeNumber(req.body?.asignaturaId);

    if (!csvText || typeof csvText !== 'string') {
      return sendError(res, 400, 'Debes enviar el texto CSV.');
    }

    if (!asignaturaId) {
      return sendError(res, 400, 'asignaturaId inválido.');
    }

    const subject = db.prepare('SELECT id FROM asignatura WHERE id = ?').get(asignaturaId);
    if (!subject) {
      return sendError(res, 404, 'La asignatura indicada no existe.');
    }

    const rows = parseCsvToObjects(csvText);
    if (rows.length === 0) {
      return res.json({
        alumnosCreados: 0,
        equiposCreados: 0,
        membresiasInsertadas: 0,
        ignoradas: 0
      });
    }

    const rosterAssignmentId = ensureRosterAssignment(asignaturaId, req.user.id);

    const selectUser = db.prepare('SELECT id FROM usuario WHERE correo = ?');
    const insertUser = db.prepare(`
      INSERT INTO usuario (correo, nombre_completo, rol, contrasena_hash, estado)
      VALUES (@correo, @nombre, 'ALUM', @hash, 'activo')
    `);
    const insertUserSubject = db.prepare(`
      INSERT OR IGNORE INTO usuario_asignatura (id_usuario, id_asignatura)
      VALUES (?, ?)
    `);
    const selectTeam = db.prepare('SELECT id FROM equipo WHERE id_tarea = ? AND nombre = ?');
    const insertTeam = db.prepare('INSERT INTO equipo (id_tarea, nombre) VALUES (?, ?)');
    const insertMember = db.prepare('INSERT OR IGNORE INTO miembro_equipo (id_equipo, id_usuario) VALUES (?, ?)');
    const removeUserFromRosterTeam = db.prepare(`
      DELETE FROM miembro_equipo
      WHERE id_usuario = @userId
        AND id_equipo IN (
          SELECT id FROM equipo WHERE id_tarea = @assignmentId
        )
    `);
    const deleteEmptyRosterTeams = db.prepare(`
      DELETE FROM equipo
      WHERE id_tarea = ?
        AND id NOT IN (SELECT DISTINCT id_equipo FROM miembro_equipo)
    `);

    const summary = {
      alumnosCreados: 0,
      equiposCreados: 0,
      membresiasInsertadas: 0,
      ignoradas: 0
    };

    const tx = db.transaction(() => {
      rows.forEach((row) => {
        const normalizedGrouping = toLowercaseIdentifier(row.agrupamiento);
        const isIndividual = normalizedGrouping === 'individual';
        const isNoGroup =
          normalizedGrouping === 'no_esta_en_un_agrupamiento' || normalizedGrouping === 'no_esta_en_un_grupo';

        const email = (row.direccion_de_correo || row.email || '').toLowerCase();
        if (!email) {
          summary.ignoradas += 1;
          return;
        }

        if (isIndividual || isNoGroup) {
          summary.ignoradas += 1;
          const existing = selectUser.get(email);
          if (existing) {
            removeUserFromRosterTeam.run({ userId: existing.id, assignmentId: rosterAssignmentId });
          }
          return;
        }

        const nombre = (row.nombre || '').trim();
        const apellidos = (row.apellidos || row.apellido_s || '').trim();
        const fullName = [nombre, apellidos].filter(Boolean).join(' ').trim() || nombre || email;

        let user = selectUser.get(email);
        let userId;
        if (!user) {
          const hash = bcrypt.hashSync('alum123', 10);
          const result = insertUser.run({
            correo: email,
            nombre: fullName,
            hash
          });
          userId = result.lastInsertRowid;
          summary.alumnosCreados += 1;
        } else {
          userId = user.id;
        }

        insertUserSubject.run(userId, asignaturaId);

        const groupingLabel = (row.agrupamiento || '').trim() || `Grupo`;
        const groupCodeRaw = (row.grupo || '').trim();
        let teamName;

        if (groupCodeRaw) {
          const normalizedCode = toLowercaseIdentifier(groupCodeRaw).replace(/_/g, '').toUpperCase() || groupCodeRaw;
          teamName = `${groupingLabel}-${normalizedCode}`;
        } else {
          teamName = groupingLabel || `Grupo ${email}`;
        }

        let team = selectTeam.get(rosterAssignmentId, teamName);
        let teamId;

        if (!team) {
          const created = insertTeam.run(rosterAssignmentId, teamName);
          teamId = created.lastInsertRowid;
          summary.equiposCreados += 1;
        } else {
          teamId = team.id;
        }

        const membership = insertMember.run(teamId, userId);
        if (membership.changes > 0) {
          summary.membresiasInsertadas += 1;
        }
      });
      deleteEmptyRosterTeams.run(rosterAssignmentId);
    });

    tx();

    const rosterLike = `${ROSTER_PREFIX}%`;
    const candidateTasks = db
      .prepare(
        `
        SELECT t.id
        FROM tarea t
        WHERE t.id_asignatura = ?
          AND t.titulo NOT LIKE ?
      `
      )
      .all(asignaturaId, rosterLike);

    const selectTeamCount = db.prepare('SELECT COUNT(*) AS total FROM equipo WHERE id_tarea = ?');
    candidateTasks.forEach((task) => {
      const teamCount = selectTeamCount.get(task.id)?.total || 0;
      if (teamCount === 0) {
        cloneRosterTeamsToAssignment(asignaturaId, task.id);
      }
    });

    res.json(summary);
  } catch (error) {
    console.error('Error al importar CSV:', error);
    return sendError(res, 500, 'No pudimos procesar el CSV.');
  }
});

router.get('/api/admin/professors', requireAuth(['ADMIN']), (_req, res) => {
  try {
    const professors = db
      .prepare(
        `
        SELECT id, nombre_completo, correo
        FROM usuario
        WHERE rol = 'PROF'
        ORDER BY nombre_completo
      `
      )
      .all();

    const result = professors.map((professor) => ({
      id: professor.id,
      nombre: professor.nombre_completo,
      correo: professor.correo,
      asignaturas: getProfessorSubjects(professor.id)
    }));

    res.json(result);
  } catch (error) {
    console.error('Error al listar profesores:', error);
    return sendError(res, 500, 'No pudimos listar los profesores.');
  }
});

router.post('/api/admin/professors', requireAuth(['ADMIN']), (req, res) => {
  try {
    const nombre = (req.body?.nombre || '').trim();
    const correo = (req.body?.correo || '').trim().toLowerCase();
    const password = (req.body?.password || DEFAULT_PROFESSOR_PASSWORD).trim();

    if (!nombre || !correo) {
      return sendError(res, 400, 'Nombre y correo son obligatorios.');
    }

    if (!password) {
      return sendError(res, 400, 'La contraseña no puede estar vacía.');
    }

    const existing = db.prepare('SELECT id FROM usuario WHERE correo = ?').get(correo);
    if (existing) {
      return sendError(res, 409, 'Ya existe un usuario con ese correo.');
    }

    const hash = bcrypt.hashSync(password, 10);
    const insert = db
      .prepare(
        `
        INSERT INTO usuario (correo, nombre_completo, rol, contrasena_hash, estado)
        VALUES (?, ?, 'PROF', ?, 'activo')
      `
      )
      .run(correo, nombre, hash);

    res.status(201).json({
      id: insert.lastInsertRowid,
      nombre,
      correo,
      asignaturas: []
    });
  } catch (error) {
    console.error('Error al crear profesor:', error);
    return sendError(res, 500, 'No pudimos crear el profesor.');
  }
});

router.post('/api/admin/professors/:professorId/subjects', requireAuth(['ADMIN']), (req, res) => {
  try {
    const professorId = safeNumber(req.params.professorId);
    const subjectIds = Array.isArray(req.body?.subjectIds) ? req.body.subjectIds.map((id) => Number(id)) : [];

    if (!professorId) {
      return sendError(res, 400, 'Identificador de profesor inválido.');
    }

    const professor = db
      .prepare(
        `
        SELECT id, nombre_completo
        FROM usuario
        WHERE id = ? AND rol = 'PROF'
      `
      )
      .get(professorId);

    if (!professor) {
      return sendError(res, 404, 'El profesor no existe.');
    }

    const validSubjects = subjectIds.filter((id) => Number.isFinite(id) && id > 0);
    const uniqueSubjects = [...new Set(validSubjects)];

    const tx = db.transaction(() => {
      db.prepare('DELETE FROM usuario_asignatura WHERE id_usuario = ?').run(professorId);
      const insert = db.prepare(
        `
        INSERT OR IGNORE INTO usuario_asignatura (id_usuario, id_asignatura)
        VALUES (?, ?)
      `
      );
      uniqueSubjects.forEach((subjectId) => {
        const subject = db.prepare('SELECT id FROM asignatura WHERE id = ?').get(subjectId);
        if (subject) {
          insert.run(professorId, subjectId);
        }
      });
    });

    tx();

    res.json({
      id: professor.id,
      nombre: professor.nombre_completo,
      asignaturas: getProfessorSubjects(professorId)
    });
  } catch (error) {
    console.error('Error al asignar profesor a asignaturas:', error);
    return sendError(res, 500, 'No pudimos asignar las asignaturas.');
  }
});

module.exports = router;
