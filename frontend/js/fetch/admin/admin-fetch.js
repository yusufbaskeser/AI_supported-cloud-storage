const ADMIN_BASE = API + '/admin';
const AUTH_BASE  = API + '/auth';

function _token() { return sessionStorage.getItem('sc-admin-token'); }

function _headers() {
  return { 'Authorization': `Bearer ${_token()}`, 'Content-Type': 'application/json' };
}

async function _req(method, url, body) {
  const opts = { method, headers: _headers() };
  if (body !== undefined) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);

  if (res.status === 401 || res.status === 403) {
    sessionStorage.removeItem('sc-admin-token');
    window.location.replace('./admin-auth');
    return null;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

const AdminFetch = {
  login: (name, password) => fetch(`${AUTH_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, password }),
  }).then(async r => {
    const d = await r.json();
    if (!r.ok) throw new Error(d.message || 'Invalid credentials.');
    return d;
  }),

  getStats:          ()           => _req('GET',    `${ADMIN_BASE}/dashboard/stats`),
  getUsers: (page, lim, filters = {}) => {
    const p = new URLSearchParams({ page, limit: lim });
    Object.entries(filters).forEach(([k, v]) => { if (v !== undefined && v !== '') p.set(k, v); });
    return _req('GET', `${ADMIN_BASE}/users/all?${p}`);
  },
  searchUsers:       (q)          => _req('GET',    `${ADMIN_BASE}/users/search?q=${encodeURIComponent(q)}`),
  getUserDetail:     (id)         => _req('GET',    `${ADMIN_BASE}/users/${id}/detail`),
  changeRole:        (id, role)   => _req('PUT',    `${ADMIN_BASE}/users/${id}/role`, { role }),
  setStorageLimit:   (id, gb)     => _req('PUT',    `${ADMIN_BASE}/users/${id}/storage-limit`, { limitGB: gb }),
  verifyUser:        (id)         => _req('PUT',    `${ADMIN_BASE}/users/${id}/verify`),
  deleteUser:        (id)         => _req('DELETE', `${ADMIN_BASE}/users/${id}/hard-delete`),
  getUserWorkspaces: (id)         => _req('GET',    `${ADMIN_BASE}/users/${id}/workspaces`),
  getUserChats:      (id)         => _req('GET',    `${ADMIN_BASE}/users/${id}/chats`),
  getWorkspaces:     (page, lim)  => _req('GET',    `${ADMIN_BASE}/workspaces/all?page=${page}&limit=${lim}`),
  getWorkspaceFiles: (id)         => _req('GET',    `${ADMIN_BASE}/workspaces/${id}/files`),
  deleteWorkspace:   (id)         => _req('DELETE', `${ADMIN_BASE}/workspaces/${id}`),
  getUntaggedFiles:  ()           => _req('GET',    `${ADMIN_BASE}/files/untagged`),
  searchFilesByTag:  (tag)        => _req('GET',    `${ADMIN_BASE}/files/search-by-tag?tag=${encodeURIComponent(tag)}`),
  forceDeleteFile:   (id)         => _req('DELETE', `${ADMIN_BASE}/files/${id}/force-delete`),
};
