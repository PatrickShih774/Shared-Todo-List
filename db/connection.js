const Database = require('better-sqlite3');
const path = require('path');
const { initSchema } = require('./schema');

let db = null;

function getDb() {
  if (db) return db;

  db = new Database(path.join(__dirname, '..', 'todos.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initSchema(db);

  return db;
}

module.exports = { getDb };
