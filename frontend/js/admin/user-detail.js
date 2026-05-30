let _user = null;
let _adminRole = null;
const _selWs = new Set();
const _selFiles = new Set();

function _e(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtBytes(b) {
  b = Number(b) || 0;
  if (b >= 1073741824) return (b / 1073741824).toFixed(2) + ' GB';
  if (b >= 1048576)    return (b / 1048576).toFixed(2) + ' MB';
  if (b >= 1024)       return (b / 1024).toFixed(1) + ' KB';
  return b + ' B';
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function roleBadge(role) {
  const map = { super: 'b-super', editor: 'b-editor', viewer: 'b-viewer', user: 'b-user' };
  return `<span class="badge ${map[role] || 'b-user'}">${_e(role || 'user')}</span>`;
}

function parseJwt(t) {
  try { return JSON.parse(atob(t.split('.')[1])); } catch { return null; }
}

function getPayload() {
  const t = sessionStorage.getItem('sc-admin-token');
  return t ? parseJwt(t) : null;
}

function adminOut() {
  sessionStorage.removeItem('sc-admin-token');
  window.location.replace('./admin-auth');
}

function toast(msg, type = 'info') {
  let wrap = document.getElementById('toastWrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'toastWrap';
    wrap.className = 'toast-wrap';
    document.body.appendChild(wrap);
  }
  const t = document.createElement('div');
  t.className = `toast ${type === 'success' ? 'ok' : type === 'error' ? 'err' : 'info'}`;
  t.innerHTML = `<div class="toast-dot"></div><span>${_e(msg)}</span>`;
  wrap.appendChild(t);
  requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('show')));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 250); }, 3200);
}

function openModal(html) {
  document.getElementById('modal')?.remove();
  const bd = document.createElement('div');
  bd.className = 'modal-backdrop';
  bd.id = 'modal';
  bd.innerHTML = `<div class="modal">${html}</div>`;
  document.body.appendChild(bd);
  bd.addEventListener('click', e => { if (e.target === bd) closeModal(); });
}

function closeModal() { document.getElementById('modal')?.remove(); }

function adminConfirm(msg) {
  return new Promise(res => {
    openModal(`
      <div class="modal-header">
        <div class="modal-header-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </div>
        <div><div class="modal-header-title">Confirm</div></div>
        <button class="modal-close" onclick="closeModal();_cr(false)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>
      <div class="modal-body"><p style="font-size:.875rem;color:var(--text-sub);line-height:1.6">${_e(msg)}</p></div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal();_cr(false)">Cancel</button>
        <button class="btn btn-danger" onclick="closeModal();_cr(true)">Confirm</button>
      </div>
    `);
    window._cr = res;
  });
}

function initTheme() {
  const saved = localStorage.getItem('sc-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  _syncThemeIcon(saved);
}

function _syncThemeIcon(t) {
  const el = document.getElementById('theme-icon');
  if (el) el.src = `../assets/icons/${t === 'dark' ? 'sun' : 'moon'}.svg`;
}

function toggleTheme() {
  const html = document.documentElement;
  html.classList.add('theme-switching');
  const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('sc-theme', next);
  _syncThemeIcon(next);
  setTimeout(() => html.classList.remove('theme-switching'), 280);
}

function canEdit() {
  return _adminRole === 'super' || _adminRole === 'editor';
}

function dimIfViewer(cls = '') {
  return canEdit() ? cls : cls + ' btn-dim';
}

function render(u) {
  _user = u;

  const pct = u.storageLimit ? Math.min(100, (u.usedStorage / u.storageLimit * 100)).toFixed(1) : 0;
  const barCls = pct >= 90 ? 'danger' : pct >= 70 ? 'warn' : '';

  const wsCount   = u.workspaces?.length ?? 0;
  const fileCount = u.workspaces?.reduce((s, ws) => s + (ws.files?.length ?? 0), 0) ?? 0;

  document.getElementById('bc-name').textContent  = u.name;
  document.getElementById('page-title').textContent = u.name;
  document.getElementById('page-sub').textContent   = u.email;

  const av = u.profile_photo
    ? `<img src="${_e(u.profile_photo)}" alt="" />`
    : `<span>${_e((u.name || '?').charAt(0).toUpperCase())}</span>`;

  const viewerNote = !canEdit()
    ? `<div style="display:flex;align-items:center;gap:6px;padding:10px 14px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:8px;font-size:.78rem;color:#fbbf24;margin-bottom:16px">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        You have viewer access — update actions are disabled.
       </div>` : '';

  document.getElementById('main-content').innerHTML = `

    <div class="profile-card">
      <div class="profile-avatar">${av}</div>
      <div class="profile-info">
        <div class="profile-name">${_e(u.name)}</div>
        <div class="profile-email">${_e(u.email)}</div>
        <div class="profile-meta">
          ${roleBadge(u.role)}
          ${u.is_verified
            ? `<span class="badge b-ok"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="9" height="9"><polyline points="20 6 9 17 4 12"/></svg> Verified</span>`
            : `<span class="badge b-warn">⏳ Unverified</span>`}
          <span class="badge b-user">ID #${u.user_id}</span>
        </div>
      </div>
      <div class="profile-stats">
        <div class="profile-stat">
          <div class="profile-stat-val">${fileCount}</div>
          <div class="profile-stat-label">Files</div>
        </div>
        <div class="profile-stat-sep"></div>
        <div class="profile-stat">
          <div class="profile-stat-val">${wsCount}</div>
          <div class="profile-stat-label">Workspaces</div>
        </div>
        <div class="profile-stat-sep"></div>
        <div class="profile-stat">
          <div class="profile-stat-val">${u.userTotalSize_MB ?? 0} MB</div>
          <div class="profile-stat-label">Used</div>
        </div>
      </div>
    </div>

    <div class="detail-grid">

      <div class="detail-card">
        <div class="detail-card-header">
          <div class="detail-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg></div>
          <span class="detail-card-title">Account Info</span>
        </div>
        <div class="detail-card-body">
          ${viewerNote}
          <div class="info-grid">
            <div class="info-item"><span class="info-label">User ID</span><span class="info-value td-id">#${u.user_id}</span></div>
            <div class="info-item"><span class="info-label">Role</span><span class="info-value">${roleBadge(u.role)}</span></div>
            <div class="info-item"><span class="info-label">Verified</span><span class="info-value">${u.is_verified ? '✓ Yes' : '✗ No'}</span></div>
            <div class="info-item"><span class="info-label">Joined</span><span class="info-value">${fmtDate(u.created_at)}</span></div>
          </div>

          <div class="divider"></div>
          <div class="section-label">Storage</div>
          <div style="margin-bottom:18px">
            <div class="storage-bar-label">
              <span>${fmtBytes(u.usedStorage)} used</span>
              <span>${fmtBytes(u.storageLimit)} limit · ${pct}%</span>
            </div>
            <div class="storage-bar-full"><div class="storage-bar-fill ${barCls}" style="width:${pct}%"></div></div>
          </div>

          <div class="divider"></div>
          <div class="section-label">Change Role</div>
          <div class="form-row" style="margin-bottom:16px">
            <div class="form-field">
              <select class="form-select" id="sel-role" ${canEdit() ? '' : 'disabled'}>
                <option value="user"   ${u.role==='user'   ?'selected':''}>User</option>
                <option value="viewer" ${u.role==='viewer' ?'selected':''}>Viewer Admin</option>
                <option value="editor" ${u.role==='editor' ?'selected':''}>Editor Admin</option>
                <option value="super"  ${u.role==='super'  ?'selected':''}>Super Admin</option>
              </select>
            </div>
            <button class="btn btn-primary btn-sm ${dimIfViewer()}" onclick="applyRole()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              Apply
            </button>
          </div>

          <div class="section-label">Storage Limit (GB)</div>
          <div class="form-row">
            <div class="form-field">
              <input class="form-input" type="number" id="inp-storage" min="0.1" step="0.5"
                value="${(Number(u.storageLimit) / 1073741824).toFixed(2)}"
                ${canEdit() ? '' : 'disabled'} />
            </div>
            <button class="btn btn-primary btn-sm ${dimIfViewer()}" onclick="applyStorage()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              Apply
            </button>
          </div>
        </div>
      </div>

      <div class="detail-card">
        <div class="tabs" id="tabs">
          <button class="tab-btn active" data-tab="workspaces" onclick="switchTab('workspaces')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            Workspaces
            <span class="tab-count">${wsCount}</span>
          </button>
          <button class="tab-btn" data-tab="files" onclick="switchTab('files')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
            Files
            <span class="tab-count">${fileCount}</span>
          </button>
          <button class="tab-btn" data-tab="chats" onclick="switchTab('chats')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Chats
          </button>
        </div>

        <div class="tab-panel active" id="tab-workspaces">
          ${renderWorkspacesTab(u.workspaces || [])}
        </div>
        <div class="tab-panel" id="tab-files">
          ${renderFilesTab(u.workspaces || [])}
        </div>
        <div class="tab-panel" id="tab-chats">
          <div class="spin-wrap"><div class="spinner"></div></div>
        </div>
      </div>

    </div>

    <div class="detail-card detail-card-full" style="margin-bottom:0">
      <div class="detail-card-header">
        <div class="detail-card-icon" style="background:rgba(239,68,68,0.1);color:#ef4444"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
        <span class="detail-card-title" style="color:#ef4444">Danger Zone</span>
      </div>
      <div class="detail-card-body">
        <div class="danger-zone">
          <div class="danger-zone-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Irreversible Actions
          </div>
          ${!u.is_verified ? `
          <div class="danger-row">
            <div>
              <div class="danger-row-title">Verify Account</div>
              <div class="danger-row-desc">Manually mark this account's email as verified.</div>
            </div>
            <button class="btn btn-warn btn-sm" onclick="doVerify()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              Verify
            </button>
          </div>` : ''}
          <div class="danger-row">
            <div>
              <div class="danger-row-title" style="color:#ef4444">Delete User</div>
              <div class="danger-row-desc">Permanently delete this account and all associated data. Cannot be undone.</div>
            </div>
            <button class="btn btn-danger btn-sm" onclick="doDelete()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              Delete Account
            </button>
          </div>
        </div>
      </div>
    </div>

  `;

  loadChats(u.user_id);
}

function updateWsBulkBtn() {
  const btn = document.getElementById('ws-bulk-btn');
  const info = document.getElementById('ws-bulk-info');
  if (!btn) return;
  const n = _selWs.size;
  btn.disabled = n === 0;
  btn.classList.toggle('active', n > 0);
  btn.querySelector('span').textContent = n > 0 ? `Delete (${n})` : 'Delete';
  if (info) { info.textContent = n > 0 ? `${n} selected` : ''; info.classList.toggle('has-sel', n > 0); }
}

function toggleWsSelect(id, checked) {
  checked ? _selWs.add(id) : _selWs.delete(id);
  updateWsBulkBtn();
}

async function bulkDeleteWs() {
  if (!_selWs.size) return;
  const n = _selWs.size;
  const ok = await adminConfirm(`Delete ${n} workspace${n > 1 ? 's' : ''} and all their files? Cannot be undone.`);
  if (!ok) return;
  let done = 0, fail = 0;
  for (const id of [..._selWs]) {
    try { await AdminFetch.deleteWorkspace(id); done++; }
    catch { fail++; }
  }
  toast(`${done} workspace${done !== 1 ? 's' : ''} deleted${fail ? `, ${fail} failed` : ''}`, done > 0 ? 'success' : 'error');
  setTimeout(() => location.reload(), 800);
}

function renderWorkspacesTab(workspaces) {
  if (!workspaces.length) {
    return `<div class="empty-state"><div class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></div><p>No workspaces yet</p></div>`;
  }
  return `
    <div class="bulk-bar">
      <span class="bulk-bar-info" id="ws-bulk-info"></span>
      <button class="btn btn-danger btn-sm btn-bulk-del" id="ws-bulk-btn" onclick="bulkDeleteWs()" disabled>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
        <span>Delete</span>
      </button>
    </div>
    <div class="ws-list">${workspaces.map(ws => `
      <div class="ws-item">
        <input type="checkbox" class="item-check" onchange="toggleWsSelect(${ws.workspace_id},this.checked)" onclick="event.stopPropagation()" />
        <div class="ws-item-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></div>
        <div class="ws-item-info">
          <div class="ws-item-name">${_e(ws.name)}</div>
          <div class="ws-item-sub">${fmtDate(ws.created_at)} · ${ws.files?.length ?? 0} file${(ws.files?.length ?? 0) !== 1 ? 's' : ''}</div>
        </div>
        <div class="ws-item-actions">
          <button class="btn btn-danger btn-sm" onclick="doDeleteWs(${ws.workspace_id},'${_e(ws.name)}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
          </button>
        </div>
      </div>
    `).join('')}</div>`;
}

function updateFilesBulkBtn() {
  const btn = document.getElementById('files-bulk-btn');
  const info = document.getElementById('files-bulk-info');
  if (!btn) return;
  const n = _selFiles.size;
  btn.disabled = n === 0;
  btn.classList.toggle('active', n > 0);
  btn.querySelector('span').textContent = n > 0 ? `Delete (${n})` : 'Delete';
  if (info) { info.textContent = n > 0 ? `${n} selected` : ''; info.classList.toggle('has-sel', n > 0); }
}

function toggleFileSelect(id, checked) {
  checked ? _selFiles.add(id) : _selFiles.delete(id);
  updateFilesBulkBtn();
}

async function bulkDeleteFiles() {
  if (!_selFiles.size) return;
  const n = _selFiles.size;
  const ok = await adminConfirm(`Permanently delete ${n} file${n > 1 ? 's' : ''}? Cannot be undone.`);
  if (!ok) return;
  let done = 0, fail = 0;
  for (const id of [..._selFiles]) {
    try { await AdminFetch.forceDeleteFile(id); done++; }
    catch { fail++; }
  }
  toast(`${done} file${done !== 1 ? 's' : ''} deleted${fail ? `, ${fail} failed` : ''}`, done > 0 ? 'success' : 'error');
  setTimeout(() => location.reload(), 800);
}

function renderFilesTab(workspaces) {
  const files = workspaces.flatMap(ws => (ws.files || []).map(f => ({ ...f, wsName: ws.name })));
  if (!files.length) {
    return `<div class="empty-state"><div class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/></svg></div><p>No files yet</p></div>`;
  }
  return `
    <div class="bulk-bar">
      <span class="bulk-bar-info" id="files-bulk-info"></span>
      <button class="btn btn-danger btn-sm btn-bulk-del" id="files-bulk-btn" onclick="bulkDeleteFiles()" disabled>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
        <span>Delete</span>
      </button>
    </div>
    <div class="file-list">${files.map(f => `
      <div class="file-item">
        <input type="checkbox" class="item-check" onchange="toggleFileSelect(${f.file_id},this.checked)" onclick="event.stopPropagation()" />
        <div class="file-item-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg></div>
        <span class="file-item-name" title="${_e(f.filename)}">${_e(f.filename)}</span>
        <span class="file-item-meta">${fmtBytes(f.size)}</span>
        <span class="file-item-meta" style="margin-left:8px">${_e(f.wsName)}</span>
        <button class="btn btn-danger btn-sm" style="margin-left:8px;flex-shrink:0" onclick="doDeleteFile(${f.file_id},'${_e(f.filename)}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
        </button>
      </div>
    `).join('')}</div>`;
}

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p => {
    p.classList.toggle('active', p.id === 'tab-' + tab);
  });
}

async function loadChats(userId) {
  const el = document.getElementById('tab-chats');
  if (!el) return;
  try {
    const chats = await AdminFetch.getUserChats(userId);
    if (!chats || !chats.length) {
      el.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div><p>No chat history</p></div>`;
      return;
    }
    const name = _user?.name || 'User';
    el.innerHTML = `<div class="chat-list">${chats.slice(-60).map(c => {
      const isUser = c.role === 'user';
      const avatar = `<div class="chat-avatar ${isUser ? 'user-av' : 'ai-av'}">${isUser ? _e(name.charAt(0).toUpperCase()) : 'AI'}</div>`;
      const body   = `<div class="chat-msg-body"><div class="chat-bubble">${_e(c.message)}</div><div class="chat-meta">${fmtDateTime(c.created_at)}</div></div>`;
      return `<div class="chat-msg ${isUser ? 'user' : 'assistant'}">${isUser ? avatar + body : body + avatar}</div>`;
    }).join('')}</div>`;
  } catch(e) {
    if (el) el.innerHTML = `<p style="color:var(--text-muted);font-size:.85rem;padding:12px">${_e(e.message)}</p>`;
  }
}

async function applyRole() {
  if (!canEdit()) return;
  const role = document.getElementById('sel-role')?.value;
  if (!role) return;
  try {
    await AdminFetch.changeRole(_user.user_id, role);
    toast('Role updated to ' + role, 'success');
    _user.role = role;
    document.querySelectorAll('.profile-meta .badge').forEach((el, i) => {
      if (i === 0) el.outerHTML = roleBadge(role);
    });
  } catch(e) { toast('Failed: ' + e.message, 'error'); }
}

async function applyStorage() {
  if (!canEdit()) return;
  const gb = parseFloat(document.getElementById('inp-storage')?.value || '0');
  if (!gb || gb < 0.1) { toast('Enter a valid limit (min 0.1 GB)', 'error'); return; }
  try {
    await AdminFetch.setStorageLimit(_user.user_id, gb);
    toast('Storage limit updated', 'success');
  } catch(e) { toast('Failed: ' + e.message, 'error'); }
}

async function doVerify() {
  if (!await adminConfirm('Manually verify this account\'s email address?')) return;
  try {
    await AdminFetch.verifyUser(_user.user_id);
    toast('User verified', 'success');
    setTimeout(() => location.reload(), 800);
  } catch(e) { toast('Failed: ' + e.message, 'error'); }
}

async function doDelete() {
  if (!await adminConfirm(`Permanently delete "${_user.name}" and ALL their data? This cannot be undone.`)) return;
  try {
    await AdminFetch.deleteUser(_user.user_id);
    toast('User deleted', 'success');
    setTimeout(() => window.location.replace('./index'), 900);
  } catch(e) { toast('Failed: ' + e.message, 'error'); }
}

async function doDeleteWs(id, name) {
  if (!await adminConfirm(`Delete workspace "${name}" and all its files? Cannot be undone.`)) return;
  try {
    await AdminFetch.deleteWorkspace(id);
    toast('Workspace deleted', 'success');
    setTimeout(() => location.reload(), 800);
  } catch(e) { toast('Failed: ' + e.message, 'error'); }
}

async function doDeleteFile(id, name) {
  if (!await adminConfirm(`Permanently delete file "${name}"?`)) return;
  try {
    await AdminFetch.forceDeleteFile(id);
    toast('File deleted', 'success');
    setTimeout(() => location.reload(), 800);
  } catch(e) { toast('Failed: ' + e.message, 'error'); }
}

(async function init() {
  const p = getPayload();
  if (!p || (p.role !== 'super' && p.role !== 'editor' && p.role !== 'viewer')) {
    adminOut();
    return;
  }

  _adminRole = p.role;
  initTheme();

  const nameEl   = document.getElementById('admin-name');
  const roleEl   = document.getElementById('admin-role');
  const avatarEl = document.getElementById('admin-avatar');
  if (nameEl)   nameEl.textContent   = p.username || p.name || p.email || 'Admin';
  if (roleEl)   roleEl.textContent   = p.role;
  if (avatarEl) avatarEl.textContent = (p.username || p.name || p.email || 'A').charAt(0).toUpperCase();

  document.getElementById('theme-btn')?.addEventListener('click', toggleTheme);
  document.getElementById('logout-btn')?.addEventListener('click', adminOut);

  const params = new URLSearchParams(location.search);
  const id = parseInt(params.get('id'));
  if (!id) {
    document.getElementById('main-content').innerHTML = `<div class="empty-state"><p>No user ID provided.</p></div>`;
    return;
  }

  try {
    const u = await AdminFetch.getUserDetail(id);
    if (!u) return;
    render(u);
  } catch(e) {
    document.getElementById('main-content').innerHTML = `<div class="empty-state"><p>Failed to load user: ${_e(e.message)}</p></div>`;
  }
})();
