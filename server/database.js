const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'isoflow.db');

let db = null;
let SQL = null;

const getDb = async () => {
  if (!db) {
    SQL = await initSqlJs();

    if (fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }

    initSchema();
    saveDb();
  }
  return db;
};

const initSchema = () => {
  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      model TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_projects_updated
      ON projects(updated_at);
  `);
};

const saveDb = () => {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
};

const closeDb = () => {
  if (db) {
    saveDb();
    db.close();
  }
};

module.exports = { getDb, saveDb, closeDb };
