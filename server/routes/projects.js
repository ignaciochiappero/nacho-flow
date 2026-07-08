const express = require('express');
const { getDb, saveDb } = require('../database');
const uuid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

const router = express.Router();

const queryAll = (db, sql, params = []) => {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
};

const queryOne = (db, sql, params = []) => {
  const rows = queryAll(db, sql, params);
  return rows.length > 0 ? rows[0] : null;
};

// List all projects
router.get('/', async (req, res) => {
  const db = await getDb();
  const projects = queryAll(db, `
    SELECT id, title, description, created_at, updated_at
    FROM projects
    ORDER BY updated_at DESC
  `);
  res.json(projects);
});

const parseModelJson = (raw) => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const sanitizeFilename = (title) => {
  return (title || 'isoflow-export').replace(/[^\w.-]+/g, '_').slice(0, 100);
};

// Get single project
router.get('/:id', async (req, res) => {
  const db = await getDb();
  const project = queryOne(db, 'SELECT * FROM projects WHERE id = ?', [req.params.id]);

  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const model = parseModelJson(project.model);

  if (!model) {
    res.status(500).json({ error: 'Project data is corrupted' });
    return;
  }

  res.json({
    ...project,
    model
  });
});

// Create project
router.post('/', async (req, res) => {
  const db = await getDb();
  const { title, description, model } = req.body;

  if (!title || !model) {
    res.status(400).json({ error: 'title and model are required' });
    return;
  }

  const id = uuid();
  const now = new Date().toISOString();

  db.run(`
    INSERT INTO projects (id, title, description, model, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [id, title, description || null, JSON.stringify(model), now, now]);
  saveDb();

  res.status(201).json({ id, title, description, created_at: now, updated_at: now });
});

// Update project
router.put('/:id', async (req, res) => {
  const db = await getDb();
  const { title, description, model } = req.body;
  const now = new Date().toISOString();

  const existing = queryOne(db, 'SELECT id FROM projects WHERE id = ?', [req.params.id]);
  if (!existing) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const updates = [];
  const values = [];

  if (title !== undefined) { updates.push('title = ?'); values.push(title); }
  if (description !== undefined) { updates.push('description = ?'); values.push(description); }
  if (model !== undefined) { updates.push('model = ?'); values.push(JSON.stringify(model)); }
  updates.push('updated_at = ?');
  values.push(now);

  values.push(req.params.id);

  db.run(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`, values);
  saveDb();

  res.json({ id: req.params.id, updated_at: now });
});

// Delete project
router.delete('/:id', async (req, res) => {
  const db = await getDb();
  const existing = queryOne(db, 'SELECT id FROM projects WHERE id = ?', [req.params.id]);

  if (!existing) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  db.run('DELETE FROM projects WHERE id = ?', [req.params.id]);
  saveDb();

  res.json({ deleted: true });
});

// Export projects as SQLite file
router.post('/export/sqlite', async (req, res) => {
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();

  const exportDb = new SQL.Database();

  exportDb.run(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      model TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT
    )
  `);

  const db = await getDb();
  const { projectIds } = req.body;

  let projects;
  if (projectIds && projectIds.length > 0) {
    const placeholders = projectIds.map(() => '?').join(',');
    projects = queryAll(db, `SELECT * FROM projects WHERE id IN (${placeholders})`, projectIds);
  } else {
    projects = queryAll(db, 'SELECT * FROM projects');
  }

  const insertSql = `INSERT INTO projects (id, title, description, model, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`;
  for (const row of projects) {
    exportDb.run(insertSql, [row.id, row.title, row.description, row.model, row.created_at, row.updated_at]);
  }

  const data = exportDb.export();
  exportDb.close();

  res.setHeader('Content-Type', 'application/x-sqlite3');
  res.setHeader('Content-Disposition', `attachment; filename="isoflow-projects-${Date.now()}.sqlite"`);
  res.send(Buffer.from(data));
});

// Export single project as JSON
router.get('/:id/export/json', async (req, res) => {
  const db = await getDb();
  const project = queryOne(db, 'SELECT * FROM projects WHERE id = ?', [req.params.id]);

  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const model = parseModelJson(project.model);

  if (!model) {
    res.status(500).json({ error: 'Project data is corrupted' });
    return;
  }

  const filename = sanitizeFilename(project.title);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}-${Date.now()}.json"`);
  res.json(model);
});

// Import SQLite file
router.post('/import/sqlite', async (req, res) => {
  const db = await getDb();
  const { projects } = req.body;

  if (!projects || !Array.isArray(projects)) {
    res.status(400).json({ error: 'projects array is required' });
    return;
  }

  const insertSql = `INSERT OR REPLACE INTO projects (id, title, description, model, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`;
  for (const row of projects) {
    const model = typeof row.model === 'string' ? row.model : JSON.stringify(row.model);
    db.run(insertSql, [row.id, row.title, row.description || null, model, row.created_at, row.updated_at]);
  }
  saveDb();

  res.json({ imported: projects.length });
});

module.exports = router;
