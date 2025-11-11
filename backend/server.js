
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const multer = require('multer');

const { db } = require('./db');
const { seedDatabase } = require('./seed');
const { generateToken, verifyCredentials, requireAuth } = require('./auth');
const { parseCsvToObjects, normalizeValue } = require('./utils/csv');
const {
  persistUploadedZip,
  extractSubmission,
  listAllFiles,
  ensureInside,
  contentFolder
} = require('./utils/deliveries');
const { fileHash } = require('./utils/fileHash');
const fsp = fs.promises;

const GRADE_WEIGHT_DELIVERY = 0.8;
const GRADE_WEIGHT_REVIEW = 0.2;
const MAX_ASSIGNMENT_SHUFFLE = 50;
const ROSTER_PREFIX = '[ROSTER]';
const DEFAULT_PROFESSOR_PASSWORD = 'prof123';
const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
const WORKSPACE_ROOT = path.join(__dirname, '..');

dotenv.config({ path: path.join(__dirname, '.env') });
seedDatabase();

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

const UPLOAD_DIR = path.join(__dirname, 'tmp', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const uploadZip = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: MAX_UPLOAD_SIZE_BYTES }
});

app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
  next();
});

function sendError(res, status, message) {
  return res.status(status).json({ error: message });
}

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function ensureAssignmentExists(assignmentId) {
  return db
    .prepare(
      `
      SELECT id, id_asignatura, titulo
      FROM tarea
      WHERE id = ?
    `
    )
    .get(assignmentId);
}

function ensureAssignmentRecord(assignmentId) {
  const existing = db.prepare('SELECT id FROM asignacion WHERE id_tarea = ?').get(assignmentId);
  if (existing) {
    return existing.id;
  }
  const result = db.prepare('INSERT INTO asignacion (id_tarea) VALUES (?)').run(assignmentId);
  return result.lastInsertRowid;
}

function ensureRosterAssignment(asignaturaId, creatorId) {
  const existing = db
    .prepare(
      `
      SELECT id FROM tarea
      WHERE id_asignatura = ?
        AND titulo LIKE ?
    `
    )
    .get(asignaturaId, `${ROSTER_PREFIX}%`);

  if (existing) {
    return existing.id;
  }

  const insert = db
    .prepare(
      `
      INSERT INTO tarea (id_asignatura, titulo, descripcion, estado, creado_por)
      VALUES (?, ?, ?, 'archivada', ?)
    `
    )
    .run(
      asignaturaId,
      `${ROSTER_PREFIX} Asignatura ${asignaturaId}`,
      'Tarea interna para administrar equipos importados.',
      creatorId
    );

  ensureAssignmentRecord(insert.lastInsertRowid);
  return insert.lastInsertRowid;
}

function cloneRosterTeamsToAssignment(asignaturaId, assignmentId) {
  const rosterAssignment = db
    .prepare(
      `
      SELECT id FROM tarea
      WHERE id_asignatura = ?
        AND titulo LIKE ?
    `
    )
    .get(asignaturaId, `${ROSTER_PREFIX}%`);

  if (!rosterAssignment) {
    return { equiposCopiados: 0, miembrosCopiados: 0 };
  }

  const rosterTeams = db.prepare('SELECT id, nombre FROM equipo WHERE id_tarea = ?').all(rosterAssignment.id);
  if (rosterTeams.length === 0) {
    return { equiposCopiados: 0, miembrosCopiados: 0 };
  }

  const selectTeam = db.prepare('SELECT id FROM equipo WHERE id_tarea = ? AND nombre = ?');
  const insertTeam = db.prepare('INSERT INTO equipo (id_tarea, nombre) VALUES (?, ?)');
  const selectMembers = db.prepare('SELECT id_usuario FROM miembro_equipo WHERE id_equipo = ?');
  const insertMember = db.prepare('INSERT OR IGNORE INTO miembro_equipo (id_equipo, id_usuario) VALUES (?, ?)');

  let equiposCopiados = 0;
  let miembrosCopiados = 0;

  const tx = db.transaction(() => {
    rosterTeams.forEach((team) => {
      const found = selectTeam.get(assignmentId, team.nombre);
      const targetTeamId = found
        ? found.id
        : insertTeam.run(assignmentId, team.nombre || `Equipo ${team.id}`).lastInsertRowid;

      if (!found) {
        equiposCopiados += 1;
      }

      const members = selectMembers.all(team.id);
      members.forEach((member) => {
        const result = insertMember.run(targetTeamId, member.id_usuario);
        if (result.changes > 0) {
          miembrosCopiados += 1;
        }
      });
    });
  });

  tx();

  return { equiposCopiados, miembrosCopiados };
}
function ensureUserTeam(assignmentId, userId) {
  const existing = db
    .prepare(
      `
      SELECT eq.id
      FROM equipo eq
      JOIN miembro_equipo me ON me.id_equipo = eq.id
      WHERE eq.id_tarea = ?
        AND me.id_usuario = ?
    `
    )
    .get(assignmentId, userId);

  if (existing) {
    return existing.id;
  }

  const teamName = `Equipo-${assignmentId}-${userId}`;
  const insertTeam = db.prepare('INSERT INTO equipo (id_tarea, nombre) VALUES (?, ?)').run(assignmentId, teamName);
  db.prepare('INSERT OR IGNORE INTO miembro_equipo (id_equipo, id_usuario) VALUES (?, ?)').run(
    insertTeam.lastInsertRowid,
    userId
  );

  return insertTeam.lastInsertRowid;
}

function getTeamMembers(teamId) {
  return db
    .prepare(
      `
      SELECT u.id, u.nombre_completo, u.correo
      FROM miembro_equipo me
      JOIN usuario u ON u.id = me.id_usuario
      WHERE me.id_equipo = ?
      ORDER BY u.nombre_completo
    `
    )
    .all(teamId);
}

function fetchSubmission(submissionId) {
  return db
    .prepare(
      `
      SELECT ent.id,
             ent.id_tarea       AS assignment_id,
             ent.id_equipo      AS team_id,
             ent.id_subidor     AS uploader_id,
             ent.nombre_zip     AS zip_name,
             ent.ruta_archivo   AS zip_path,
             ent.tamano_bytes   AS size_bytes,
             ent.fecha_subida   AS uploaded_at
      FROM entregas ent
      WHERE ent.id = ?
    `
    )
    .get(submissionId);
}

function userBelongsToTeam(teamId, userId) {
  return !!db
    .prepare(
      `
      SELECT 1
      FROM miembro_equipo
      WHERE id_equipo = ?
        AND id_usuario = ?
      LIMIT 1
    `
    )
    .get(teamId, userId);
}

function isReviewerOfSubmission(submissionId, userId) {
  return !!db
    .prepare(
      `
      SELECT 1
      FROM revision rev
      JOIN equipo eq ON eq.id = rev.id_revisores
      JOIN miembro_equipo me ON me.id_equipo = eq.id
      WHERE rev.id_entrega = ?
        AND me.id_usuario = ?
      LIMIT 1
    `
    )
    .get(submissionId, userId);
}

function ensureSubmissionAccess(submissionId, user, { allowReviewers = true } = {}) {
  const submission = fetchSubmission(submissionId);
  if (!submission) {
    return null;
  }

  if (user.rol === 'ADMIN' || user.rol === 'PROF') {
    return submission;
  }

  if (user.rol === 'ALUM') {
    if (userBelongsToTeam(submission.team_id, user.id)) {
      return submission;
    }
    if (allowReviewers && isReviewerOfSubmission(submissionId, user.id)) {
      return submission;
    }
  }

  return null;
}

function fetchRevisionContext(revisionId) {
  return db
    .prepare(
      `
      SELECT rev.id,
             rev.id_entrega     AS submission_id,
             rev.id_revisores   AS reviewer_team_id,
             ent.id_tarea       AS assignment_id,
             ent.id_equipo      AS author_team_id,
             ent.ruta_archivo   AS zip_path,
             ent.nombre_zip     AS zip_name
      FROM revision rev
      JOIN entregas ent ON ent.id = rev.id_entrega
      WHERE rev.id = ?
    `
    )
    .get(revisionId);
}

function ensureRevisionPermission(revisionId, user, { allowOwners = false } = {}) {
  const revision = fetchRevisionContext(revisionId);
  if (!revision) {
    return null;
  }

  if (user.rol === 'ADMIN' || user.rol === 'PROF') {
    return revision;
  }

  if (user.rol === 'ALUM') {
    if (userBelongsToTeam(revision.reviewer_team_id, user.id)) {
      return revision;
    }
    if (allowOwners && userBelongsToTeam(revision.author_team_id, user.id)) {
      return revision;
    }
  }

  return null;
}

function isLikelyBinary(buffer) {
  const sampleLength = Math.min(buffer.length, 8192);
  for (let i = 0; i < sampleLength; i += 1) {
    if (buffer[i] === 0) {
      return true;
    }
  }
  return false;
}

function shuffleArray(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

function buildDerangement(ids) {
  if (ids.length < 2) {
    return ids.slice();
  }

  for (let attempt = 0; attempt < MAX_ASSIGNMENT_SHUFFLE; attempt += 1) {
    const shuffled = shuffleArray(ids);
    const valid = ids.every((value, index) => value !== shuffled[index]);
    if (valid) {
      return shuffled;
    }
  }

  const rotated = ids.slice(1);
  rotated.push(ids[0]);
  return rotated;
}

function buildTeamAssignments(assignmentId) {
  const assignment = ensureAssignmentExists(assignmentId);
  if (!assignment) {
    throw new Error('La tarea no existe.');
  }

  const submissions = db
    .prepare(
      `
      SELECT e.id AS entrega_id,
             e.id_equipo AS equipo_autor_id,
             eq.nombre AS equipo_autor_nombre
      FROM entregas e
      JOIN equipo eq ON eq.id = e.id_equipo
      WHERE e.id_tarea = ?
      ORDER BY e.id
    `
    )
    .all(assignmentId);

  if (submissions.length < 2) {
    return { assignmentId, pairs: [] };
  }

  const teamOrder = Array.from(new Set(submissions.map((row) => row.equipo_autor_id)));
  if (teamOrder.length < 2) {
    return { assignmentId, pairs: [] };
  }

  const reviewerOrder = buildDerangement(teamOrder);
  const assignmentRecordId = ensureAssignmentRecord(assignmentId);

  const teamNameMap = new Map();
  submissions.forEach((row) => {
    teamNameMap.set(row.equipo_autor_id, row.equipo_autor_nombre);
  });

  const submissionByTeam = new Map();
  submissions.forEach((row) => {
    submissionByTeam.set(row.equipo_autor_id, row.entrega_id);
  });

  const insertRevision = db.prepare(
    `
    INSERT INTO revision (id_asignacion, id_entrega, id_revisores)
    VALUES (?, ?, ?)
    ON CONFLICT(id_entrega, id_revisores) DO UPDATE SET
      fecha_asignacion = datetime('now'),
      fecha_envio = NULL,
      respuestas_json = NULL,
      nota_numerica = NULL,
      comentario_extra = NULL
  `
  );

  const tx = db.transaction(() => {
    teamOrder.forEach((authorTeamId, index) => {
      const reviewerTeamId = reviewerOrder[index];
      const entregaId = submissionByTeam.get(authorTeamId);
      insertRevision.run(assignmentRecordId, entregaId, reviewerTeamId);
    });
  });

  tx();

  const pairs = teamOrder.map((authorTeamId, index) => {
    const reviewerTeamId = reviewerOrder[index];
    return {
      equipoAutor: {
        id: authorTeamId,
        nombre: teamNameMap.get(authorTeamId)
      },
      equipoRevisor: {
        id: reviewerTeamId,
        nombre: teamNameMap.get(reviewerTeamId)
      },
      entregas: [submissionByTeam.get(authorTeamId)],
      revisores: getTeamMembers(reviewerTeamId)
    };
  });

  return {
    assignmentId,
    pairs
  };
}

function fetchAssignmentRubric(assignmentId) {
  const assignmentRecord = db.prepare('SELECT id FROM asignacion WHERE id_tarea = ?').get(assignmentId);
  if (!assignmentRecord) {
    return [];
  }

  return db
    .prepare(
      `
      SELECT id, clave_item, texto, peso, tipo, obligatorio, minimo, maximo, orden
      FROM rubrica_items
      WHERE id_asignacion = ?
      ORDER BY orden
    `
    )
    .all(assignmentRecord.id);
}

function fetchAssignmentMap(assignmentId) {
  const assignmentRecord = db.prepare('SELECT id FROM asignacion WHERE id_tarea = ?').get(assignmentId);
  if (!assignmentRecord) {
    return { assignmentId, pairs: [] };
  }

  const rows = db
    .prepare(
      `
      SELECT rev.id,
             rev.id_entrega,
             rev.id_revisores,
             ent.id_equipo AS equipo_autor_id,
             equipo_autor.nombre AS equipo_autor_nombre,
             equipo_revisor.nombre AS equipo_revisor_nombre
      FROM revision rev
      JOIN entregas ent ON ent.id = rev.id_entrega
      JOIN equipo equipo_autor ON equipo_autor.id = ent.id_equipo
      JOIN equipo equipo_revisor ON equipo_revisor.id = rev.id_revisores
      WHERE rev.id_asignacion = ?
      ORDER BY rev.id
    `
    )
    .all(assignmentRecord.id);

  const pairs = rows.map((row) => ({
    revisionId: row.id,
    equipoAutor: {
      id: row.equipo_autor_id,
      nombre: row.equipo_autor_nombre
    },
    equipoRevisor: {
      id: row.id_revisores,
      nombre: row.equipo_revisor_nombre
    },
    entregas: [row.id_entrega],
    revisores: getTeamMembers(row.id_revisores)
  }));

  return {
    assignmentId,
    pairs
  };
}

function formatGradesAsCsv(rows) {
  const header = 'email;autor_nombre;nota_entrega;bonus_review;nota_final';
  const lines = rows.map((row) =>
    [row.email || '', row.nombre || '', row.nota_entrega ?? '', row.bonus_review ?? '', row.nota_final ?? ''].join(';')
  );
  return [header, ...lines].join('\n');
}

function getProfessorSubjects(professorId) {
  return db
    .prepare(
      `
      SELECT a.id, a.nombre, a.codigo
      FROM usuario_asignatura ua
      JOIN asignatura a ON a.id = ua.id_asignatura
      WHERE ua.id_usuario = ?
      ORDER BY a.nombre
    `
    )
    .all(professorId);
}
app.get('/', (_req, res) => {
  res.json({ status: 'Peer Review API ready' });
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/login', (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return sendError(res, 400, 'Email y contraseña son obligatorios.');
    }

    const user = verifyCredentials(email, password);
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

app.get('/api/me', requireAuth(), (req, res) => {
  res.json({
    id: req.user.id,
    nombre: req.user.nombre,
    email: req.user.email,
    rol: req.user.rol
  });
});

app.post('/api/asignaturas', requireAuth(['ADMIN', 'PROF']), (req, res) => {
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

app.get('/api/asignaturas', requireAuth(['ADMIN', 'PROF']), (_req, res) => {
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

app.post('/api/admin/import-roster', requireAuth(['ADMIN', 'PROF']), (req, res) => {
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
        const normalizedGrouping = normalizeValue(row.agrupamiento);
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
          // Normalizamos el código para evitar caracteres raros y mantenemos un formato consistente.
          const normalizedCode = normalizeValue(groupCodeRaw).replace(/_/g, '').toUpperCase() || groupCodeRaw;
          teamName = `${groupingLabel}-${normalizedCode}`;
        } else {
          // Si no hay código de grupo, conservamos el comportamiento anterior.
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

    res.json(summary);
  } catch (error) {
    console.error('Error al importar CSV:', error);
    return sendError(res, 500, 'No pudimos procesar el CSV.');
  }
});

app.get('/api/admin/professors', requireAuth(['ADMIN']), (_req, res) => {
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

app.post('/api/admin/professors', requireAuth(['ADMIN']), (req, res) => {
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

app.post('/api/admin/professors/:professorId/subjects', requireAuth(['ADMIN']), (req, res) => {
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

app.get('/api/assignments', requireAuth(), (req, res) => {
  try {
    const rows = db
      .prepare(
        `
        SELECT id, id_asignatura, titulo, descripcion, fecha_entrega, estado
        FROM tarea
        WHERE titulo NOT LIKE ?
        ORDER BY fecha_entrega IS NULL, fecha_entrega DESC, id DESC
      `
      )
      .all(`${ROSTER_PREFIX}%`);

    res.json(rows);
  } catch (error) {
    console.error('Error al listar tareas:', error);
    return sendError(res, 500, 'No pudimos listar las tareas.');
  }
});

app.post('/api/assignments', requireAuth(['ADMIN', 'PROF']), (req, res) => {
  try {
    const title = (req.body?.titulo || req.body?.title || '').trim();
    const description = (req.body?.descripcion || req.body?.description || '').trim();
    const dueDateRaw = (req.body?.fechaEntrega || req.body?.dueDate || '').trim();
    const subjectId = safeNumber(req.body?.asignaturaId || req.body?.subjectId);

    if (!title) {
      return sendError(res, 400, 'El título es obligatorio.');
    }

    if (!subjectId) {
      return sendError(res, 400, 'Debes indicar la asignatura.');
    }

    const subject = db.prepare('SELECT id FROM asignatura WHERE id = ?').get(subjectId);
    if (!subject) {
      return sendError(res, 404, 'La asignatura indicada no existe.');
    }

    const insert = db
      .prepare(
        `
        INSERT INTO tarea (id_asignatura, titulo, descripcion, fecha_entrega, estado, creado_por)
        VALUES (?, ?, ?, ?, 'abierta', ?)
      `
      )
      .run(subjectId, title, description || null, dueDateRaw || null, req.user.id);

    const assignmentId = insert.lastInsertRowid;
    ensureAssignmentRecord(assignmentId);
    cloneRosterTeamsToAssignment(subjectId, assignmentId);

    const created = db
      .prepare(
        `
        SELECT id, id_asignatura, titulo, descripcion, fecha_entrega, estado
        FROM tarea
        WHERE id = ?
      `
      )
      .get(assignmentId);

    res.status(201).json(created);
  } catch (error) {
    console.error('Error al crear tarea:', error);
    return sendError(res, 500, 'No pudimos crear la tarea.');
  }
});

app.get('/api/assignments/:assignmentId', requireAuth(), (req, res) => {
  try {
    const assignmentId = safeNumber(req.params.assignmentId);
    if (!assignmentId) {
      return sendError(res, 400, 'Identificador inválido.');
    }

    const assignment = ensureAssignmentExists(assignmentId);
    if (!assignment) {
      return sendError(res, 404, 'La tarea no existe.');
    }

    res.json(assignment);
  } catch (error) {
    console.error('Error al obtener tarea:', error);
    return sendError(res, 500, 'No pudimos obtener la tarea.');
  }
});

app.post('/api/assignments/:assignmentId/rubrica', requireAuth(['ADMIN', 'PROF']), (req, res) => {
  try {
    const assignmentId = safeNumber(req.params.assignmentId);
    if (!assignmentId) {
      return sendError(res, 400, 'Identificador inválido.');
    }

    const assignment = ensureAssignmentExists(assignmentId);
    if (!assignment) {
      return sendError(res, 404, 'La tarea no existe.');
    }

    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (items.length === 0) {
      return sendError(res, 400, 'Debes enviar al menos un ítem de rúbrica.');
    }

    const assignmentRecordId = ensureAssignmentRecord(assignmentId);
    db.prepare('DELETE FROM rubrica_items WHERE id_asignacion = ?').run(assignmentRecordId);

    const insertItem = db.prepare(`
      INSERT INTO rubrica_items (id_asignacion, titulo_rubrica, clave_item, texto, tipo, peso, obligatorio, minimo, maximo, orden)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const tx = db.transaction(() => {
      items.forEach((item, index) => {
        const clave = (item.clave || item.key || `item_${index + 1}`).trim();
        const texto = (item.texto || item.label || item.descripcion || '').trim();
        const peso = Number(item.peso ?? item.weight ?? 1) || 1;
        const tipo = item.tipo || 'numero';
        const obligatorio = item.obligatorio ? 1 : 0;

        insertItem.run(
          assignmentRecordId,
          'Rúbrica general',
          clave,
          texto || `Criterio ${index + 1}`,
          tipo,
          peso,
          obligatorio,
          item.minimo ?? null,
          item.maximo ?? null,
          index + 1
        );
      });
    });

    tx();

    res.json({ ok: true });
  } catch (error) {
    console.error('Error al guardar rúbrica:', error);
    return sendError(res, 500, 'No pudimos guardar la rúbrica.');
  }
});

app.get('/api/assignments/:assignmentId/rubrica', requireAuth(), (req, res) => {
  try {
    const assignmentId = safeNumber(req.params.assignmentId);
    if (!assignmentId) {
      return sendError(res, 400, 'Identificador inválido.');
    }

    const items = fetchAssignmentRubric(assignmentId);
    res.json(items);
  } catch (error) {
    console.error('Error al obtener rúbrica:', error);
    return sendError(res, 500, 'No pudimos obtener la rúbrica.');
  }
});

app.post(
  '/api/submissions',
  requireAuth(['ALUM']),
  uploadZip.single('zipFile'),
  async (req, res) => {
    let tempPathToClean = '';
    try {
      const assignmentId = safeNumber(req.body?.assignmentId);
      const authorUserId = safeNumber(req.body?.authorUserId) || req.user.id;

      if (!assignmentId) {
        return sendError(res, 400, 'Debes indicar la tarea.');
      }

      if (authorUserId !== req.user.id) {
        return sendError(res, 403, 'Solo puedes registrar tus propias entregas.');
      }

      const assignment = ensureAssignmentExists(assignmentId);
      if (!assignment) {
        return sendError(res, 404, 'La tarea no existe.');
      }

      const teamId = ensureUserTeam(assignmentId, req.user.id);

      const existing = db
        .prepare(
          `
          SELECT id
          FROM entregas
          WHERE id_tarea = ? AND id_equipo = ?
        `
        )
        .get(assignmentId, teamId);

      if (existing) {
        return sendError(res, 409, 'Tu equipo ya registró esta entrega.');
      }

      if (!req.file) {
        return sendError(res, 400, 'Selecciona un archivo ZIP antes de subir.');
      }

      const originalName = req.file.originalname || 'entrega.zip';
      tempPathToClean = req.file.path;

      if (!originalName.toLowerCase().endsWith('.zip')) {
        return sendError(res, 400, 'El archivo debe tener extensión .zip.');
      }

      const stored = await persistUploadedZip(req.file.path, assignmentId, teamId, originalName);
      await extractSubmission(assignmentId, teamId, stored.absolutePath);

      const insert = db
        .prepare(
          `
          INSERT INTO entregas (id_tarea, id_equipo, id_subidor, nombre_zip, ruta_archivo, tamano_bytes)
          VALUES (?, ?, ?, ?, ?, ?)
        `
        )
        .run(assignmentId, teamId, req.user.id, originalName, stored.relativePath, req.file.size || null);

      const created = db
        .prepare(
          `
          SELECT id,
                 id_tarea,
                 id_equipo,
                 id_subidor,
                 nombre_zip,
                 ruta_archivo,
                 tamano_bytes,
                 fecha_subida
          FROM entregas
          WHERE id = ?
        `
        )
        .get(insert.lastInsertRowid);

      return res.status(201).json(created);
    } catch (error) {
      console.error('Error al registrar entrega:', error);
      return sendError(res, 500, 'No pudimos registrar la entrega.');
    } finally {
      if (tempPathToClean) {
        fs.promises
          .unlink(tempPathToClean)
          .catch(() => {});
      }
    }
  }
);

app.get('/api/submissions', requireAuth(), (req, res) => {
  try {
    const assignmentId = safeNumber(req.query.assignmentId);
    if (!assignmentId) {
      return sendError(res, 400, 'Debes indicar assignmentId.');
    }

    const assignment = ensureAssignmentExists(assignmentId);
    if (!assignment) {
      return sendError(res, 404, 'La tarea no existe.');
    }

    let rows = [];

    if (req.user.rol === 'ALUM') {
      rows = db
        .prepare(
          `
          SELECT e.id,
                 e.nombre_zip,
                 e.fecha_subida,
                 e.id_equipo,
                 e.id_subidor,
                 e.ruta_archivo,
                 e.tamano_bytes
          FROM entregas e
          JOIN equipo eq ON eq.id = e.id_equipo
          JOIN miembro_equipo me ON me.id_equipo = eq.id
          WHERE e.id_tarea = ? AND me.id_usuario = ?
          ORDER BY e.fecha_subida DESC
        `
        )
        .all(assignmentId, req.user.id);
    } else {
      rows = db
        .prepare(
          `
          SELECT e.id,
                 e.nombre_zip,
                 e.fecha_subida,
                 e.id_equipo,
                 e.id_subidor,
                 e.ruta_archivo,
                 e.tamano_bytes,
                 u.nombre_completo AS autor_nombre,
                 u.correo AS autor_correo
          FROM entregas e
          LEFT JOIN usuario u ON u.id = e.id_subidor
          WHERE e.id_tarea = ?
          ORDER BY e.fecha_subida DESC
        `
        )
        .all(assignmentId);
    }

    res.json(rows);
  } catch (error) {
    console.error('Error al listar entregas:', error);
    return sendError(res, 500, 'No pudimos listar las entregas.');
  }
});

app.get('/api/submissions/:submissionId/download', requireAuth(), (req, res) => {
  try {
    const submissionId = safeNumber(req.params.submissionId);
    if (!submissionId) {
      return sendError(res, 400, 'Identificador inválido.');
    }

    const submission = ensureSubmissionAccess(submissionId, req.user);
    if (!submission) {
      return sendError(res, 403, 'No puedes descargar esta entrega.');
    }

    if (!submission.zip_path) {
      return sendError(res, 404, 'Esta entrega no tiene archivo asociado.');
    }

    const pathCandidates = path.isAbsolute(submission.zip_path)
      ? [submission.zip_path]
      : [
          path.join(__dirname, submission.zip_path),
          path.join(WORKSPACE_ROOT, submission.zip_path)
        ];
    const absolutePath = pathCandidates.find((candidate) => fs.existsSync(candidate));
    if (!absolutePath) {
      return sendError(res, 404, 'No encontramos el ZIP en el servidor.');
    }

    res.download(absolutePath, submission.zip_name || path.basename(absolutePath));
  } catch (error) {
    console.error('Error al descargar entrega:', error);
    return sendError(res, 500, 'No pudimos descargar la entrega.');
  }
});

app.get('/api/reviews/:revisionId/files', requireAuth(), async (req, res) => {
  try {
    const revisionId = safeNumber(req.params.revisionId);
    if (!revisionId) {
      return sendError(res, 400, 'Identificador de revisión inválido.');
    }

    const revision = ensureRevisionPermission(revisionId, req.user, { allowOwners: true });
    if (!revision) {
      return sendError(res, 403, 'No puedes ver los archivos de esta revisión.');
    }

    const baseDir = contentFolder(revision.assignment_id, revision.author_team_id);
    if (!fs.existsSync(baseDir)) {
      return sendError(res, 404, 'Todavía no hay archivos descomprimidos para esta entrega.');
    }

    const files = await listAllFiles(baseDir);
    return res.json({
      revisionId,
      submissionId: revision.submission_id,
      zipName: revision.zip_name,
      files
    });
  } catch (error) {
    console.error('Error al listar archivos de revisión:', error);
    return sendError(res, 500, 'No pudimos cargar el árbol de archivos.');
  }
});

app.get('/api/reviews/:revisionId/file', requireAuth(), async (req, res) => {
  try {
    const revisionId = safeNumber(req.params.revisionId);
    const relativePath = (req.query.path || '').toString().replace(/^[\\/]+/, '').trim();

    if (!revisionId || !relativePath) {
      return sendError(res, 400, 'Debes indicar la revisión y el archivo.');
    }

    const revision = ensureRevisionPermission(revisionId, req.user, { allowOwners: true });
    if (!revision) {
      return sendError(res, 403, 'No puedes abrir este archivo.');
    }

    const baseDir = contentFolder(revision.assignment_id, revision.author_team_id);
    if (!fs.existsSync(baseDir)) {
      return sendError(res, 404, 'No encontramos los archivos descomprimidos.');
    }

    const absolutePath = ensureInside(baseDir, relativePath);
    const stats = await fsp.stat(absolutePath);
    if (!stats.isFile()) {
      return sendError(res, 400, 'La ruta indicada no es un fichero.');
    }

    const buffer = await fsp.readFile(absolutePath);
    const isBinary = isLikelyBinary(buffer);
    const sha1 = await fileHash(absolutePath, 'sha1');

    const comments = db
      .prepare(
        `
        SELECT cc.id,
               cc.linea,
               cc.contenido,
               cc.creado_en,
               usr.nombre_completo AS autor_nombre,
               usr.correo          AS autor_correo
        FROM code_comment cc
        LEFT JOIN usuario usr ON usr.id = cc.autor_id
        WHERE cc.revision_id = ?
          AND cc.sha1 = ?
        ORDER BY cc.linea, cc.id
      `
      )
      .all(revisionId, sha1)
      .map((row) => ({
        id: row.id,
        linea: row.linea,
        contenido: row.contenido,
        creado_en: row.creado_en,
        autor: row.autor_nombre ? { nombre: row.autor_nombre, correo: row.autor_correo } : null
      }));

    return res.json({
      path: relativePath.replace(/\\/g, '/'),
      size: stats.size,
      isBinary,
      sha1,
      content: isBinary ? null : buffer.toString('utf8'),
      comments
    });
  } catch (error) {
    console.error('Error al leer archivo de revisión:', error);
    return sendError(res, 500, 'No pudimos abrir el archivo solicitado.');
  }
});

app.post('/api/reviews/:revisionId/comments', requireAuth(), async (req, res) => {
  try {
    const revisionId = safeNumber(req.params.revisionId);
    const relativePath = (req.body?.path || req.body?.ruta || '').toString().replace(/^[\\/]+/, '').trim();
    const linea = safeNumber(req.body?.line || req.body?.linea);
    const contenido = (req.body?.contenido || req.body?.text || '').toString().trim();

    if (!revisionId || !relativePath) {
      return sendError(res, 400, 'Falta indicar el archivo.');
    }
    if (!linea || linea <= 0) {
      return sendError(res, 400, 'La línea indicada no es válida.');
    }
    if (!contenido) {
      return sendError(res, 400, 'El comentario no puede estar vacío.');
    }

    const revision = ensureRevisionPermission(revisionId, req.user);
    if (!revision) {
      return sendError(res, 403, 'No puedes comentar este archivo.');
    }

    const baseDir = contentFolder(revision.assignment_id, revision.author_team_id);
    if (!fs.existsSync(baseDir)) {
      return sendError(res, 404, 'No encontramos los archivos de la entrega.');
    }

    const absolutePath = ensureInside(baseDir, relativePath);
    const stats = await fsp.stat(absolutePath);
    if (!stats.isFile()) {
      return sendError(res, 400, 'Solo puedes comentar archivos.');
    }

    const sha1 = await fileHash(absolutePath, 'sha1');

    const insert = db
      .prepare(
        `
        INSERT INTO code_comment (revision_id, sha1, ruta_archivo, linea, contenido, autor_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `
      )
      .run(revisionId, sha1, relativePath.replace(/\\/g, '/'), linea, contenido, req.user.id);

    const created = db
      .prepare(
        `
        SELECT cc.id,
               cc.linea,
               cc.contenido,
               cc.creado_en,
               usr.nombre_completo AS autor_nombre,
               usr.correo          AS autor_correo
        FROM code_comment cc
        LEFT JOIN usuario usr ON usr.id = cc.autor_id
        WHERE cc.id = ?
      `
      )
      .get(insert.lastInsertRowid);

    return res.status(201).json({
      id: created.id,
      linea: created.linea,
      contenido: created.contenido,
      creado_en: created.creado_en,
      autor: created.autor_nombre ? { nombre: created.autor_nombre, correo: created.autor_correo } : null,
      sha1
    });
  } catch (error) {
    console.error('Error al guardar comentario de código:', error);
    return sendError(res, 500, 'No pudimos guardar el comentario.');
  }
});
app.post('/api/assignments/:assignmentId/assign', requireAuth(['ADMIN', 'PROF']), (req, res) => {
  try {
    const assignmentId = safeNumber(req.params.assignmentId);
    if (!assignmentId) {
      return sendError(res, 400, 'Identificador inválido.');
    }

    const result = buildTeamAssignments(assignmentId);
    res.json(result);
  } catch (error) {
    console.error('Error al generar asignación:', error);
    return sendError(res, 500, 'No pudimos generar la asignación.');
  }
});

app.get('/api/assignments/:assignmentId/assignment-map', requireAuth(['ADMIN', 'PROF']), (req, res) => {
  try {
    const assignmentId = safeNumber(req.params.assignmentId);
    if (!assignmentId) {
      return sendError(res, 400, 'Identificador inválido.');
    }

    const result = fetchAssignmentMap(assignmentId);
    res.json(result);
  } catch (error) {
    console.error('Error al obtener asignación:', error);
    return sendError(res, 500, 'No pudimos obtener la asignación.');
  }
});

app.get('/api/reviews', requireAuth(), (req, res) => {
  try {
    const submissionId = safeNumber(req.query.submissionId);
    if (!submissionId) {
      return sendError(res, 400, 'Debes indicar submissionId.');
    }

    const rows = db
      .prepare(
        `
        SELECT rev.id,
               rev.id_entrega,
               rev.id_revisores,
               rev.fecha_asignacion,
               rev.fecha_envio,
               rev.respuestas_json,
               rev.nota_numerica,
               rev.comentario_extra,
               eq.nombre AS equipo_revisor_nombre
        FROM revision rev
        JOIN equipo eq ON eq.id = rev.id_revisores
        WHERE rev.id_entrega = ?
        ORDER BY rev.fecha_asignacion DESC
      `
      )
      .all(submissionId);

    const formatted = rows.map((row) => ({
      id: row.id,
      id_entrega: row.id_entrega,
      equipo_revisor: {
        id: row.id_revisores,
        nombre: row.equipo_revisor_nombre,
        miembros: getTeamMembers(row.id_revisores)
      },
      fecha_asignacion: row.fecha_asignacion,
      fecha_envio: row.fecha_envio,
      respuestas: row.respuestas_json ? JSON.parse(row.respuestas_json) : null,
      nota_numerica: row.nota_numerica,
      comentario: row.comentario_extra
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Error al listar revisiones:', error);
    return sendError(res, 500, 'No pudimos obtener las revisiones.');
  }
});

app.get('/api/my-review-tasks', requireAuth(['ALUM']), (req, res) => {
  try {
    const rows = db
      .prepare(
        `
        SELECT DISTINCT
          rev.id,
          rev.id_entrega,
          rev.fecha_asignacion,
          rev.fecha_envio,
          rev.respuestas_json,
          rev.nota_numerica,
          rev.comentario_extra,
          ent.id_tarea AS assignment_id,
          tar.titulo AS assignment_title,
          ent.nombre_zip AS submission_zip,
          ent.fecha_subida AS submission_date
        FROM revision rev
        JOIN equipo eq ON eq.id = rev.id_revisores
        JOIN miembro_equipo me ON me.id_equipo = eq.id
        JOIN entregas ent ON ent.id = rev.id_entrega
        JOIN tarea tar ON tar.id = ent.id_tarea
        WHERE me.id_usuario = ?
        ORDER BY rev.fecha_asignacion DESC
      `
      )
      .all(req.user.id);

    const formatted = rows.map((row) => ({
      id: row.id,
      assignmentId: row.assignment_id,
      assignmentTitle: row.assignment_title,
      submissionId: row.id_entrega,
      submissionZip: row.submission_zip,
      assignedAt: row.fecha_asignacion,
      submittedAt: row.fecha_envio,
      nota_numerica: row.nota_numerica,
      comentario: row.comentario_extra,
      respuestas: row.respuestas_json ? JSON.parse(row.respuestas_json) : null
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Error al listar tareas de revisión:', error);
    return sendError(res, 500, 'No pudimos obtener tus revisiones.');
  }
});

app.post('/api/reviews', requireAuth(['ALUM']), (req, res) => {
  try {
    const submissionId = safeNumber(req.body?.submissionId);
    const reviewerUserId = safeNumber(req.body?.reviewerUserId) || req.user.id;
    const respuestasJson = req.body?.respuestasJson || req.body?.respuestas || null;
    const comentario = (req.body?.comentario || req.body?.comentarioExtra || '').trim();
    const notaNumerica = req.body?.notaNumerica !== undefined ? Number(req.body.notaNumerica) : null;

    if (!submissionId) {
      return sendError(res, 400, 'Debes indicar submissionId.');
    }

    if (reviewerUserId !== req.user.id) {
      return sendError(res, 403, 'Solo puedes completar tus propias revisiones.');
    }

    const revision = db
      .prepare(
        `
        SELECT rev.id
        FROM revision rev
        JOIN equipo eq ON eq.id = rev.id_revisores
        JOIN miembro_equipo me ON me.id_equipo = eq.id
        WHERE rev.id_entrega = ?
          AND me.id_usuario = ?
      `
      )
      .get(submissionId, req.user.id);

    if (!revision) {
      return sendError(res, 404, 'No tienes una revisión asignada para esta entrega.');
    }

    db.prepare(
      `
      UPDATE revision
      SET respuestas_json = ?, nota_numerica = ?, comentario_extra = ?, fecha_envio = datetime('now')
      WHERE id = ?
    `
    ).run(respuestasJson ? JSON.stringify(respuestasJson) : null, notaNumerica, comentario || null, revision.id);

    const updated = db
      .prepare(
        `
        SELECT id, id_entrega, id_revisores, fecha_asignacion, fecha_envio, respuestas_json, nota_numerica, comentario_extra
        FROM revision
        WHERE id = ?
      `
      )
      .get(revision.id);

    res.json({
      id: updated.id,
      id_entrega: updated.id_entrega,
      id_revisores: updated.id_revisores,
      fecha_asignacion: updated.fecha_asignacion,
      fecha_envio: updated.fecha_envio,
      respuestas: updated.respuestas_json ? JSON.parse(updated.respuestas_json) : null,
      nota_numerica: updated.nota_numerica,
      comentario: updated.comentario_extra
    });
  } catch (error) {
    console.error('Error al guardar revisión:', error);
    return sendError(res, 500, 'No pudimos guardar la revisión.');
  }
});

app.post('/api/reviews/:reviewId/meta', requireAuth(['ADMIN', 'PROF']), (req, res) => {
  try {
    const reviewId = safeNumber(req.params.reviewId);
    if (!reviewId) {
      return sendError(res, 400, 'Identificador inválido.');
    }

    const revision = db
      .prepare(
        `
        SELECT rev.id, ent.id_tarea AS assignment_id, ent.id AS entrega_id
        FROM revision rev
        JOIN entregas ent ON ent.id = rev.id_entrega
        WHERE rev.id = ?
      `
      )
      .get(reviewId);

    if (!revision) {
      return sendError(res, 404, 'La revisión no existe.');
    }

    const notaCalidad = req.body?.nota_calidad !== undefined ? Number(req.body.nota_calidad) : null;
    const observacion = (req.body?.observacion || '').trim();

    const existing = db.prepare('SELECT id FROM meta_revision WHERE id_revision = ?').get(reviewId);

    if (existing) {
      db.prepare(
        `
        UPDATE meta_revision
        SET nota_calidad = ?, observacion = ?, fecha_registro = datetime('now')
        WHERE id = ?
      `
      ).run(notaCalidad, observacion || null, existing.id);
    } else {
      db.prepare(
        `
        INSERT INTO meta_revision (id_tarea, id_entrega, id_revision, id_profesor, nota_calidad, observacion)
        VALUES (?, ?, ?, ?, ?, ?)
      `
      ).run(revision.assignment_id, revision.entrega_id, reviewId, req.user.id, notaCalidad, observacion || null);
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Error al registrar meta-revisión:', error);
    return sendError(res, 500, 'No pudimos registrar la meta-revisión.');
  }
});

app.get('/api/export/grades', requireAuth(['ADMIN', 'PROF']), (req, res) => {
  try {
    const assignmentId = safeNumber(req.query.assignmentId);
    const format = (req.query.format || 'json').toLowerCase();

    if (!assignmentId) {
      return sendError(res, 400, 'Debes indicar assignmentId.');
    }

    const assignment = ensureAssignmentExists(assignmentId);
    if (!assignment) {
      return sendError(res, 404, 'La tarea no existe.');
    }

    const grades = db
      .prepare(
        `
        SELECT ent.id AS entrega_id,
               ent.id_subidor AS autor_id,
               usr.correo AS autor_email,
               usr.nombre_completo AS autor_nombre,
               AVG(rev.nota_numerica) AS promedio_nota
        FROM entregas ent
        LEFT JOIN usuario usr ON usr.id = ent.id_subidor
        LEFT JOIN revision rev ON rev.id_entrega = ent.id AND rev.fecha_envio IS NOT NULL AND rev.nota_numerica IS NOT NULL
        WHERE ent.id_tarea = ?
        GROUP BY ent.id
      `
      )
      .all(assignmentId);

    const bonusRows = db
      .prepare(
        `
        SELECT me.id_usuario AS user_id,
               AVG(meta.nota_calidad) AS bonus
        FROM meta_revision meta
        JOIN revision rev ON rev.id = meta.id_revision
        JOIN equipo eq ON eq.id = rev.id_revisores
        JOIN miembro_equipo me ON me.id_equipo = eq.id
        WHERE meta.id_tarea = ?
          AND meta.nota_calidad IS NOT NULL
        GROUP BY me.id_usuario
      `
      )
      .all(assignmentId);

    const bonusMap = new Map();
    bonusRows.forEach((row) => {
      bonusMap.set(row.user_id, Number(row.bonus));
    });

    const result = grades.map((row) => {
      const notaEntrega = row.promedio_nota !== null ? Number(row.promedio_nota.toFixed(2)) : null;
      const bonusReview = bonusMap.has(row.autor_id)
        ? Number(bonusMap.get(row.autor_id).toFixed(2))
        : null;
      const bonusForFormula = bonusReview !== null ? bonusReview : 0;
      const finalScore =
        notaEntrega !== null
          ? Number((notaEntrega * GRADE_WEIGHT_DELIVERY + bonusForFormula * GRADE_WEIGHT_REVIEW).toFixed(2))
          : null;

      return {
        email: row.autor_email,
        nombre: row.autor_nombre,
        nota_entrega: notaEntrega,
        bonus_review: bonusReview,
        nota_final: finalScore
      };
    });

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="grades-assignment-${assignmentId}.csv"`);
      res.send(formatGradesAsCsv(result));
      return;
    }

    res.json({
      assignmentId,
      rows: result
    });
  } catch (error) {
    console.error('Error al exportar notas:', error);
    return sendError(res, 500, 'No pudimos exportar las notas.');
  }
});

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
