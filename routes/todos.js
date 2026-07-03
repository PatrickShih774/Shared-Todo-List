const { Router } = require('express');
const { getDb } = require('../db/connection');
const { getOnlineUsers } = require('../socket/handler');

const router = Router();

// --- Auth middleware ---
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Helper: expand user references in a todo row
const PRIORITY_MAP = { high: 'q1', medium: 'q3', low: 'q4' };

function expandTodo(db, row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    priority: PRIORITY_MAP[row.priority] || row.priority || 'q4',
    due_date: row.due_date,
    completed: row.completed === 1,
    created_by: { id: row.created_by_id, username: row.created_by_username },
    assigned_to: row.assigned_to_id
      ? { id: row.assigned_to_id, username: row.assigned_to_username }
      : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

const TODO_SELECT = `
  SELECT
    t.id, t.title, t.description, t.priority, t.due_date, t.completed,
    t.created_by, t.assigned_to, t.created_at, t.updated_at,
    cb.id AS created_by_id, cb.username AS created_by_username,
    au.id AS assigned_to_id, au.username AS assigned_to_username
  FROM todos t
  JOIN users cb ON t.created_by = cb.id
  LEFT JOIN users au ON t.assigned_to = au.id
`;

// GET /api/todos
router.get('/todos', requireAuth, (req, res) => {
  const db = getDb();
  const filter = req.query.filter;
  let rows;
  if (filter === 'active') {
    rows = db.prepare(`${TODO_SELECT} WHERE t.completed = 0 ORDER BY t.created_at DESC`).all();
  } else if (filter === 'completed') {
    rows = db.prepare(`${TODO_SELECT} WHERE t.completed = 1 ORDER BY t.created_at DESC`).all();
  } else {
    rows = db.prepare(`${TODO_SELECT} ORDER BY t.created_at DESC`).all();
  }
  res.json({ todos: rows.map(r => expandTodo(db, r)) });
});

// POST /api/todos
router.post('/todos', requireAuth, (req, res) => {
  const { title, description, priority, due_date, assigned_to } = req.body;
  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }

  const db = getDb();
  const validPriority = ['q1', 'q2', 'q3', 'q4'].includes(priority) ? priority : 'q4';
  const assignee = assigned_to ? (parseInt(assigned_to, 10) || null) : null;

  const result = db.prepare(`
    INSERT INTO todos (title, description, priority, due_date, created_by, assigned_to)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(title.trim(), description || '', validPriority, due_date || null, req.session.userId, assignee);

  const row = db.prepare(`${TODO_SELECT} WHERE t.id = ?`).get(result.lastInsertRowid);
  const todo = expandTodo(db, row);

  const io = req.app.get('io');
  io.emit('todo:created', { todo, byUser: { id: req.session.userId, username: req.session.username } });

  res.status(201).json({ todo });
});

// PUT /api/todos/:id
router.put('/todos/:id', requireAuth, (req, res) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare('SELECT id FROM todos WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Todo not found' });
  }

  const { title, description, priority, due_date, completed, assigned_to } = req.body;
  const updates = [];
  const values = [];

  if (title !== undefined) {
    if (!title.trim()) return res.status(400).json({ error: 'Title cannot be empty' });
    updates.push('title = ?');
    values.push(title.trim());
  }
  if (description !== undefined) {
    updates.push('description = ?');
    values.push(description);
  }
  if (priority !== undefined) {
    if (!['q1', 'q2', 'q3', 'q4'].includes(priority)) {
      return res.status(400).json({ error: 'Invalid quadrant' });
    }
    updates.push('priority = ?');
    values.push(priority);
  }
  if (due_date !== undefined) {
    updates.push('due_date = ?');
    values.push(due_date || null);
  }
  if (completed !== undefined) {
    updates.push('completed = ?');
    values.push(completed ? 1 : 0);
  }
  if (assigned_to !== undefined) {
    const assignee = assigned_to ? (parseInt(assigned_to, 10) || null) : null;
    updates.push('assigned_to = ?');
    values.push(assignee);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  updates.push("updated_at = datetime('now', 'localtime')");
  db.prepare(`UPDATE todos SET ${updates.join(', ')} WHERE id = ?`).run(...values, id);

  const row = db.prepare(`${TODO_SELECT} WHERE t.id = ?`).get(id);
  const todo = expandTodo(db, row);

  const io = req.app.get('io');
  io.emit('todo:updated', { todo, byUser: { id: req.session.userId, username: req.session.username } });

  res.json({ todo });
});

// DELETE /api/todos/:id
router.delete('/todos/:id', requireAuth, (req, res) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare('SELECT id FROM todos WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Todo not found' });
  }

  db.prepare('DELETE FROM todos WHERE id = ?').run(id);

  const io = req.app.get('io');
  io.emit('todo:deleted', { id: parseInt(id, 10), byUser: { id: req.session.userId, username: req.session.username } });

  res.json({ ok: true });
});

// GET /api/users
router.get('/users', requireAuth, (req, res) => {
  const db = getDb();
  const users = db.prepare('SELECT id, username FROM users').all();
  const onlineUsers = getOnlineUsers();
  const onlineIds = new Set(onlineUsers.map(u => u.userId));

  const result = users.map(u => ({
    ...u,
    online: onlineIds.has(u.id),
  }));

  res.json({ users: result });
});

module.exports = router;
