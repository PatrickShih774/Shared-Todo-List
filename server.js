const express = require('express');
const http = require('http');
const session = require('express-session');
const { Server } = require('socket.io');
const path = require('path');
const { getDb } = require('./db/connection');
const { setupSocket } = require('./socket/handler');

const app = express();
const server = http.createServer(app);

// --- Session ---
const sessionMiddleware = session({
  secret: 'todo-shared-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 },
});

app.use(sessionMiddleware);

// --- Body parsing ---
app.use(express.json());

// --- Static files ---
app.use(express.static(path.join(__dirname, 'public')));

// --- Socket.io ---
const io = new Server(server);
// Share session middleware with Socket.io
io.engine.use(sessionMiddleware);

setupSocket(io);
app.set('io', io);

// --- Routes ---
const authRouter = require('./routes/auth');
const todosRouter = require('./routes/todos');

app.use('/api', authRouter);
app.use('/api', todosRouter);

// --- Start ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  const db = getDb();
  const users = db.prepare('SELECT id, username FROM users').all();
  console.log(`✅ Server running at http://localhost:${PORT}`);
  console.log(`👥 Users: ${users.map(u => u.username).join(', ')}`);
});
