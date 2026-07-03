const { Router } = require('express');
const { getDb } = require('../db/connection');

const router = Router();

// POST /api/login
router.post('/login', (req, res) => {
  const { username } = req.body;
  if (!username || typeof username !== 'string') {
    return res.status(400).json({ error: 'Username is required' });
  }

  const db = getDb();
  const user = db.prepare('SELECT id, username FROM users WHERE username = ?').get(username.trim());
  if (!user) {
    return res.status(401).json({ error: 'Invalid user' });
  }

  req.session.userId = user.id;
  req.session.username = user.username;
  res.json({ ok: true, user });
});

// POST /api/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

// GET /api/me
router.get('/me', (req, res) => {
  if (req.session.userId) {
    res.json({ user: { id: req.session.userId, username: req.session.username } });
  } else {
    res.json({ user: null });
  }
});

module.exports = router;
