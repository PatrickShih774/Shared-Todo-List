/**
 * API client
 */

async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) {
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(path, opts);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

async function login(username) {
  return request('POST', '/api/login', { username });
}

async function logout() {
  return request('POST', '/api/logout');
}

async function getMe() {
  return request('GET', '/api/me');
}

async function getTodos(filter) {
  const qs = filter && filter !== 'all' ? `?filter=${filter}` : '';
  return request('GET', `/api/todos${qs}`);
}

async function createTodo(data) {
  return request('POST', '/api/todos', data);
}

async function updateTodo(id, data) {
  return request('PUT', `/api/todos/${id}`, data);
}

async function deleteTodo(id) {
  return request('DELETE', `/api/todos/${id}`);
}

async function getUsers() {
  return request('GET', '/api/users');
}
