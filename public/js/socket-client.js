/**
 * Socket.io client
 */

const socket = io();

let currentUserId = null;

function initSocket(userId) {
  currentUserId = userId;
  if (socket.connected) {
    socket.emit('user:join', { userId, username: state.currentUser?.username });
  }
}

// Re-emit on reconnect
socket.on('connect', () => {
  if (currentUserId && state.currentUser) {
    socket.emit('user:join', { userId: currentUserId, username: state.currentUser.username });
  }
});

socket.on('todo:created', (data) => {
  if (data.todo && data.byUser?.id !== currentUserId) {
    state.todos = [data.todo, ...state.todos];
    renderTodoList();
  }
});

socket.on('todo:updated', (data) => {
  if (data.todo) {
    const idx = state.todos.findIndex(t => t.id === data.todo.id);
    if (idx !== -1) {
      state.todos[idx] = data.todo;
    } else {
      state.todos.unshift(data.todo);
    }
    renderTodoList();
  }
});

socket.on('todo:deleted', (data) => {
  state.todos = state.todos.filter(t => t.id !== data.id);
  renderTodoList();
});

socket.on('users:online', (users) => {
  state.onlineUsers = users;
  renderOnlineUsers();
});
