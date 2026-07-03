function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      username   TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS todos (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT NOT NULL,
      description TEXT DEFAULT '',
      priority    TEXT NOT NULL DEFAULT 'q4',
      due_date    TEXT,
      completed   INTEGER NOT NULL DEFAULT 0,
      created_by  INTEGER NOT NULL REFERENCES users(id),
      assigned_to INTEGER REFERENCES users(id),
      created_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_todos_completed ON todos(completed);
    CREATE INDEX IF NOT EXISTS idx_todos_assigned  ON todos(assigned_to);

    INSERT OR IGNORE INTO users (username) VALUES ('Boss'), ('Assistant1'), ('Assistant2');
  `);
}

module.exports = { initSchema };
