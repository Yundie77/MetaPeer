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

const computeFinal = (q1, q2) => {
  const raw = 0.3 * Number(q1) + 0.7 * Number(q2);
  return Math.round(raw * 100) / 100;
};

const assignmentsQuery = {
  list: db.prepare('SELECT id, title, due_date FROM assignments ORDER BY id DESC'),
  getById: db.prepare('SELECT id, title, due_date FROM assignments WHERE id = ?'),
  insert: db.prepare('INSERT INTO assignments (title, due_date) VALUES (?, ?)')
};

const submissionsQuery = {
  listByAssignment: db.prepare(
    'SELECT id, assignment_id, author, zip_name, created_at FROM submissions WHERE assignment_id = ? ORDER BY created_at DESC'
  ),
  insert: db.prepare(
    'INSERT INTO submissions (assignment_id, author, zip_name, created_at) VALUES (?, ?, ?, datetime(\'now\'))'
  ),
  getById: db.prepare(
    'SELECT id, assignment_id, author, zip_name, created_at FROM submissions WHERE id = ?'
  )
};

const reviewsQuery = {
  listBySubmission: db.prepare(
    'SELECT id, submission_id, reviewer, score_q1, score_q2, comment, created_at FROM reviews WHERE submission_id = ? ORDER BY created_at DESC'
  ),
  insert: db.prepare(
    'INSERT INTO reviews (submission_id, reviewer, score_q1, score_q2, comment, created_at) VALUES (?, ?, ?, ?, ?, datetime(\'now\'))'
  ),
  getById: db.prepare(
    'SELECT id, submission_id, reviewer, score_q1, score_q2, comment, created_at FROM reviews WHERE id = ?'
  )
};

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/assignments', (_req, res) => {
  try {
    const assignments = assignmentsQuery.list.all();
    res.json(assignments);
  } catch (error) {
    console.error('Failed to list assignments', error);
    res.status(400).json({ error: 'Unable to load assignments.' });
  }
});

app.post('/api/assignments', (req, res) => {
  try {
    const { title, due_date } = req.body || {};
    if (!title) {
      return res.status(400).json({ error: 'Title is required.' });
    }
    const result = assignmentsQuery.insert.run(title, due_date || null);
    const assignment = assignmentsQuery.getById.get(result.lastInsertRowid);
    res.status(201).json(assignment);
  } catch (error) {
    console.error('Failed to create assignment', error);
    res.status(400).json({ error: 'Unable to create assignment.' });
  }
});

app.get('/api/submissions', (req, res) => {
  try {
    const { assignmentId } = req.query;
    if (!assignmentId) {
      return res.status(400).json({ error: 'assignmentId is required.' });
    }
    const submissions = submissionsQuery.listByAssignment.all(Number(assignmentId));
    res.json(submissions);
  } catch (error) {
    console.error('Failed to list submissions', error);
    res.status(400).json({ error: 'Unable to load submissions.' });
  }
});

app.post('/api/submissions', (req, res) => {
  try {
    const { assignment_id, author, zip_name } = req.body || {};
    if (!assignment_id || !author || !zip_name) {
      return res.status(400).json({ error: 'assignment_id, author, and zip_name are required.' });
    }
    const result = submissionsQuery.insert.run(Number(assignment_id), author, zip_name);
    const submission = submissionsQuery.getById.get(result.lastInsertRowid);
    res.status(201).json(submission);
  } catch (error) {
    console.error('Failed to create submission', error);
    res.status(400).json({ error: 'Unable to create submission.' });
  }
});

app.get('/api/reviews', (req, res) => {
  try {
    const { submissionId } = req.query;
    if (!submissionId) {
      return res.status(400).json({ error: 'submissionId is required.' });
    }
    const reviews = reviewsQuery.listBySubmission.all(Number(submissionId)).map((review) => ({
      ...review,
      final: computeFinal(review.score_q1, review.score_q2)
    }));
    res.json(reviews);
  } catch (error) {
    console.error('Failed to list reviews', error);
    res.status(400).json({ error: 'Unable to load reviews.' });
  }
});

app.post('/api/reviews', (req, res) => {
  try {
    const { submission_id, reviewer, score_q1, score_q2, comment } = req.body || {};
    if (!submission_id || !reviewer || score_q1 === undefined || score_q2 === undefined) {
      return res.status(400).json({ error: 'submission_id, reviewer, score_q1, and score_q2 are required.' });
    }
    const result = reviewsQuery.insert.run(
      Number(submission_id),
      reviewer,
      Number(score_q1),
      Number(score_q2),
      comment || null
    );
    const review = reviewsQuery.getById.get(result.lastInsertRowid);
    res.status(201).json({ ...review, final: computeFinal(review.score_q1, review.score_q2) });
  } catch (error) {
    console.error('Failed to create review', error);
    res.status(400).json({ error: 'Unable to create review.' });
  }
});

app.post('/api/assignments/:id/assign-one', (req, res) => {
  try {
    const { candidates = [], reviewers = [] } = req.body || {};
    const validPairs = [];

    candidates.forEach((candidate) => {
      if (!candidate || candidate.submissionId == null || !candidate.author) {
        return;
      }
      reviewers.forEach((reviewer) => {
        if (reviewer && reviewer !== candidate.author) {
          validPairs.push({ submissionId: candidate.submissionId, reviewer });
        }
      });
    });

    if (!validPairs.length) {
      return res.status(400).json({ error: 'No valid reviewer found for the provided candidates.' });
    }

    const pick = validPairs[Math.floor(Math.random() * validPairs.length)];
    res.json(pick);
  } catch (error) {
    console.error('Failed to assign reviewer', error);
    res.status(400).json({ error: 'Unable to assign reviewer.' });
  }
});

app.get('/api/export/grades', (req, res) => {
  try {
    const { assignmentId } = req.query;
    if (!assignmentId) {
      return res.status(400).json({ error: 'assignmentId is required.' });
    }

    const rows = db
      .prepare(
        `SELECT s.id AS submissionId, s.author AS author, AVG(0.3 * r.score_q1 + 0.7 * r.score_q2) AS finalScore
         FROM submissions s
         JOIN reviews r ON r.submission_id = s.id
         WHERE s.assignment_id = ?
         GROUP BY s.id, s.author
         ORDER BY s.id`
      )
      .all(Number(assignmentId));

    const header = 'submissionId,author,finalScore';
    const lines = rows.map((row) => {
      const score = row.finalScore == null ? '' : (Math.round(row.finalScore * 100) / 100).toFixed(2);
      return `${row.submissionId},${row.author},${score}`;
    });

    const csv = [header, ...lines].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=grades-assignment-${assignmentId}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Failed to export grades', error);
    res.status(400).json({ error: 'Unable to export grades.' });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Peer review backend listening on port ${PORT}`);
});

