/**
 * Main application logic
 */

// ===== State =====
const state = {
  currentUser: null,
  todos: [],
  filter: 'all',
  viewMode: 'quadrant',  // 'list' | 'quadrant'
  onlineUsers: [],
};

// ===== DOM refs =====
const $ = (sel) => document.querySelector(sel);
const loginScreen = $('#login-screen');
const appScreen = $('#app-screen');
const currentUsername = $('#current-username');
const todoList = $('#todo-list');
const todoForm = $('#todo-form');
const todoTitle = $('#todo-title');
const todoDescription = $('#todo-description');
const todoPriority = $('#todo-priority');
const todoDueDate = $('#todo-due-date');
const todoAssignee = $('#todo-assignee');
const itemsCount = $('#items-count');
const onlineIndicator = $('#online-indicator');
const logoutBtn = $('#logout-btn');
const modal = $('#edit-modal');
const editForm = $('#edit-form');
const editTitle = $('#edit-title');
const editDescription = $('#edit-description');
const editPriority = $('#edit-priority');
const editDueDate = $('#edit-due-date');
const editAssignee = $('#edit-assignee');
const editCancelBtn = $('#edit-cancel-btn');
const quadrantView = $('#quadrant-view');
const viewBtns = document.querySelectorAll('.view-btn');

let editingTodoId = null;

// ===== Init =====
async function init() {
  try {
    const { user } = await getMe();
    if (user) {
      state.currentUser = user;
      showApp();
      await loadUsers();
      await loadTodos();
      initSocket(user.id);
    } else {
      showLogin();
    }
  } catch {
    showLogin();
  }
}

// ===== Screen switching =====
function showLogin() {
  loginScreen.style.display = 'flex';
  appScreen.style.display = 'none';
}

function showApp() {
  loginScreen.style.display = 'none';
  appScreen.style.display = 'flex';
  currentUsername.textContent = state.currentUser.username;
  // Boss 只看清单，不显示新增表单
  todoForm.style.display = state.currentUser.username === 'Boss' ? 'none' : '';
}

// ===== Login =====
document.querySelectorAll('.user-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const username = btn.dataset.username;
    try {
      const { user } = await login(username);
      state.currentUser = user;
      showApp();
      await loadUsers();
      await loadTodos();
      initSocket(user.id);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
});

// ===== Logout =====
logoutBtn.addEventListener('click', async () => {
  await logout();
  state.currentUser = null;
  state.todos = [];
  showLogin();
});

// ===== Load users (for assignee dropdown) =====
async function loadUsers() {
  try {
    const { users } = await getUsers();
    const options = users.map(u =>
      `<option value="${u.id}">${u.username}${u.online ? ' 🟢' : ''}</option>`
    );

    // Main form
    todoAssignee.innerHTML = '<option value="">指派给...</option>' + options.join('');

    // Edit modal
    editAssignee.innerHTML = '<option value="">不指派</option>' + options.join('');
  } catch (err) {
    console.error('Failed to load users:', err);
  }
}

// ===== Load todos =====
async function loadTodos(filter) {
  try {
    const { todos } = await getTodos(filter || state.filter);
    state.todos = todos;
    renderTodoList();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ===== Render (switch by view mode) =====
function renderTodoList() {
  if (state.viewMode === 'quadrant') {
    renderQuadrantView();
  } else {
    renderListView();
  }
}

// ===== Render list view =====
function renderListView() {
  let items = state.todos;
  if (state.filter === 'active') {
    items = items.filter(t => !t.completed);
  } else if (state.filter === 'completed') {
    items = items.filter(t => t.completed);
  }

  quadrantView.style.display = 'none';
  todoList.style.display = '';

  if (items.length === 0) {
    todoList.innerHTML = '<li class="empty-state">暂无待办事项</li>';
    itemsCount.textContent = `共 ${state.todos.length} 项`;
    return;
  }

  const completedCount = state.todos.filter(t => t.completed).length;
  const totalCount = state.todos.length;
  itemsCount.textContent = `共 ${totalCount} 项，已完成 ${completedCount} 项`;

  todoList.innerHTML = items.map(t => renderTodoItem(t)).join('');
}

function renderTodoItem(t) {
  const quadrantLabels = { q1: '重要且紧急', q2: '重要不紧急', q3: '不重要但紧急', q4: '不重要不紧急' };
  const quadrantIcons = { q1: '🔴', q2: '🔵', q3: '🟡', q4: '🟢' };
  const today = new Date().toISOString().split('T')[0];
  const isOverdue = t.due_date && !t.completed && t.due_date < today;

  let dueHtml = '';
  if (t.due_date) {
    const dueClass = isOverdue ? 'due-date-overdue' : '';
    dueHtml = `<span class="${dueClass}">📅 ${t.due_date}</span>`;
  }

  const qClass = `${t.priority}-badge`;
  const qLabel = quadrantIcons[t.priority] + ' ' + (quadrantLabels[t.priority] || '');

  return `
    <li class="todo-item ${t.completed ? 'completed' : ''}" data-id="${t.id}">
      <input type="checkbox" class="todo-checkbox" ${t.completed ? 'checked' : ''}>
      <div class="todo-content">
        <div class="todo-title">${escapeHtml(t.title)}</div>
        ${t.description ? `<div class="todo-description">${escapeHtml(t.description)}</div>` : ''}
        <div class="todo-meta">
          <span class="priority-badge ${qClass}">${qLabel}</span>
          ${dueHtml}
          <span>👤 ${escapeHtml(t.created_by.username)}</span>
          ${t.assigned_to ? `<span>→ ${escapeHtml(t.assigned_to.username)}</span>` : ''}
          <span>${relativeTime(t.created_at)}</span>
        </div>
      </div>
      <div class="todo-actions">
        <button class="btn-edit" data-action="edit">编辑</button>
        <button class="btn-delete" data-action="delete">删除</button>
      </div>
    </li>
  `;
}

// ===== Quadrant helpers =====
const Q_MAP = { q1: 1, q2: 2, q3: 3, q4: 4 };

function renderQuadrantView() {
  todoList.style.display = 'none';
  quadrantView.style.display = '';

  let items = state.todos;
  if (state.filter === 'active') {
    items = items.filter(t => !t.completed);
  } else if (state.filter === 'completed') {
    items = items.filter(t => t.completed);
  }

  // Group items by stored quadrant
  const groups = { 1: [], 2: [], 3: [], 4: [] };
  for (const t of items) {
    const q = Q_MAP[t.priority] || 4;
    groups[q].push(t);
  }

  // Render each quadrant
  for (let q = 1; q <= 4; q++) {
    const list = document.querySelector(`.quadrant-list[data-quadrant="${q}"]`);
    const todos = groups[q];
    if (todos.length === 0) {
      list.innerHTML = '<div class="quadrant-empty">暂无事项</div>';
    } else {
      list.innerHTML = todos.map(t => renderQuadrantItem(t)).join('');
    }
  }

  const totalCount = state.todos.length;
  const completedCount = state.todos.filter(t => t.completed).length;
  itemsCount.textContent = `共 ${totalCount} 项，已完成 ${completedCount} 项`;
}

function renderQuadrantItem(t) {
  const isOverdue = t.due_date && !t.completed && t.due_date < new Date().toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];
  const isNearDue = t.due_date && !t.completed && t.due_date >= today && t.due_date <= new Date(Date.now() + 3*86400000).toISOString().split('T')[0];
  const showMeta = isOverdue || isNearDue || t.assigned_to;

  return `
    <li class="quadrant-todo ${t.completed ? 'completed' : ''}" data-id="${t.id}">
      <input type="checkbox" class="quadrant-todo-checkbox" ${t.completed ? 'checked' : ''}>
      <div class="quadrant-todo-content">
        <div class="quadrant-todo-title">${escapeHtml(t.title)}</div>
        ${showMeta ? `<div class="quadrant-todo-meta">
          ${isOverdue ? '<span style="color:var(--danger)">⚠️ 已逾期</span>' : ''}
          ${isNearDue ? '📅 即将到期' : ''}
          ${t.assigned_to ? `→ ${escapeHtml(t.assigned_to.username)}` : ''}
        </div>` : ''}
      </div>
      <div class="quadrant-todo-actions">
        <button class="btn-edit-q" data-action="edit" title="编辑">✏️</button>
        <button class="btn-delete-q" data-action="delete" title="删除">🗑️</button>
      </div>
    </li>
  `;
}

// ===== Event delegation on todo list =====
todoList.addEventListener('change', (e) => {
  if (e.target.classList.contains('todo-checkbox')) {
    const li = e.target.closest('.todo-item');
    if (li) {
      const id = parseInt(li.dataset.id, 10);
      const completed = e.target.checked;
      handleToggleTodo(id, completed);
    }
  }
});

todoList.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const li = btn.closest('.todo-item');
  if (!li) return;
  const id = parseInt(li.dataset.id, 10);
  const action = btn.dataset.action;

  if (action === 'edit') {
    handleEditTodo(id);
  } else if (action === 'delete') {
    handleDeleteTodo(id);
  }
});

// ===== Event delegation on quadrant view =====
quadrantView.addEventListener('change', (e) => {
  if (e.target.classList.contains('quadrant-todo-checkbox')) {
    const li = e.target.closest('.quadrant-todo');
    if (li) {
      const id = parseInt(li.dataset.id, 10);
      handleToggleTodo(id, e.target.checked);
    }
  }
});

quadrantView.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const li = btn.closest('.quadrant-todo');
  if (!li) return;
  const id = parseInt(li.dataset.id, 10);
  const action = btn.dataset.action;
  if (action === 'edit') handleEditTodo(id);
  else if (action === 'delete') handleDeleteTodo(id);
});

// ===== View toggle =====
viewBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    viewBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.viewMode = btn.dataset.view;
    renderTodoList();
  });
});

// ===== Toggle complete =====
async function handleToggleTodo(id, completed) {
  try {
    await updateTodo(id, { completed });
  } catch (err) {
    showToast(err.message, 'error');
    loadTodos();
  }
}

// ===== Delete =====
async function handleDeleteTodo(id) {
  if (!confirm('确定删除该待办事项？')) return;
  try {
    await deleteTodo(id);
    state.todos = state.todos.filter(t => t.id !== id);
    renderTodoList();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ===== Edit - Open modal =====
function handleEditTodo(id) {
  const todo = state.todos.find(t => t.id === id);
  if (!todo) return;
  editingTodoId = id;
  editTitle.value = todo.title;
  editDescription.value = todo.description || '';
  editPriority.value = todo.priority || 'q4';
  editDueDate.value = todo.due_date || '';
  editAssignee.value = todo.assigned_to ? todo.assigned_to.id : '';
  modal.style.display = 'flex';
}

// ===== Edit - Save =====
editForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!editingTodoId) return;

  const data = {
    title: editTitle.value.trim(),
    description: editDescription.value.trim(),
    priority: editPriority.value,
    due_date: editDueDate.value || null,
    assigned_to: editAssignee.value || null,
  };

  try {
    await updateTodo(editingTodoId, data);
    modal.style.display = 'none';
    editingTodoId = null;
    showToast('已更新', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// ===== Edit - Cancel =====
editCancelBtn.addEventListener('click', () => {
  modal.style.display = 'none';
  editingTodoId = null;
});

// Close modal on overlay click
modal.addEventListener('click', (e) => {
  if (e.target === modal) {
    modal.style.display = 'none';
    editingTodoId = null;
  }
});

// Close modal on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modal.style.display === 'flex') {
    modal.style.display = 'none';
    editingTodoId = null;
  }
});

// ===== Create todo =====
todoForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = todoTitle.value.trim();
  if (!title) return;

  const data = {
    title,
    description: todoDescription.value.trim(),
    priority: todoPriority.value,
    due_date: todoDueDate.value || null,
    assigned_to: todoAssignee.value || null,
  };

  try {
    const { todo } = await createTodo(data);
    state.todos = [todo, ...state.todos];
    renderTodoList();
    todoForm.reset();
    todoTitle.focus();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// ===== Filter =====
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.filter = btn.dataset.filter;
    renderTodoList();
  });
});

// ===== Online users =====
function renderOnlineUsers() {
  const allNames = ['Boss', 'Assistant1', 'Assistant2'];
  const onlineNames = new Set(state.onlineUsers.map(u => u.username));

  onlineIndicator.innerHTML = allNames.map(name => {
    const isOnline = onlineNames.has(name);
    const label = name === 'Boss' ? '老板' : name === 'Assistant1' ? '助理1' : '助理2';
    return `<span class="online-dot ${isOnline ? 'online' : ''}"><span class="dot-label">${label}</span></span>`;
  }).join('');
}

// ===== Start =====
document.addEventListener('DOMContentLoaded', init);
