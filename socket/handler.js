const onlineUsers = new Map(); // socketId -> { userId, username }

function setupSocket(io) {
  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    socket.on('user:join', ({ userId, username }) => {
      onlineUsers.set(socket.id, { userId, username });
      broadcastOnlineUsers(io);
    });

    socket.on('disconnect', () => {
      onlineUsers.delete(socket.id);
      broadcastOnlineUsers(io);
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });
}

function broadcastOnlineUsers(io) {
  const users = Array.from(onlineUsers.values());
  // Deduplicate by userId (a user may have multiple tabs)
  const unique = [];
  const seen = new Set();
  for (const u of users) {
    if (!seen.has(u.userId)) {
      seen.add(u.userId);
      unique.push(u);
    }
  }
  io.emit('users:online', unique);
}

function getOnlineUsers() {
  const users = Array.from(onlineUsers.values());
  const unique = [];
  const seen = new Set();
  for (const u of users) {
    if (!seen.has(u.userId)) {
      seen.add(u.userId);
      unique.push(u);
    }
  }
  return unique;
}

module.exports = { setupSocket, getOnlineUsers };
