let _page = 1;
let _filters = {};
const _selUsers = new Set();

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
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 250); }, 3000);
}

function openModal(html, large = false) {
  document.getElementById('modal')?.remove();
  const bd = document.createElement('div');
  bd.className = 'modal-backdrop';
  bd.id = 'modal';
  bd.innerHTML = `<div class="modal${large ? ' lg' : ''}">${html}</div>`;
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

function drawDonut(stats) {
  const svg = document.getElementById('donut-svg');
  const legend = document.getElementById('donut-legend');
  if (!svg || !legend) return;

  const cx = 110, cy = 110, r = 85, sw = 22;
  const circ = 2 * Math.PI * r;
  const total = Math.max(stats.totalUsers || 0, 1);

  const today   = Math.max(0, stats.newUsersToday || 0);
  const week    = Math.max(0, (stats.newUsersWeek || 0) - today);
  const older   = Math.max(0, total - today - week);

  const segs = [
    { val: older, color: '#3b82f6', label: 'Existing users', key: 'older' },
    { val: week,  color: '#06b6d4', label: 'New this week',  key: 'week' },
    { val: today, color: '#22c55e', label: 'New today',      key: 'today' },
  ];

  let angle = -90;
  const arcs = segs.map(s => {
    const pct = s.val / total;
    const arc = pct * circ;
    const el = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${sw}"
      stroke-dasharray="${arc.toFixed(2)} ${circ.toFixed(2)}"
      transform="rotate(${angle.toFixed(2)}, ${cx}, ${cy})"
      stroke-linecap="butt"/>`;
    angle += pct * 360;
    return el;
  });

  svg.innerHTML = `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="${sw}"/>
    ${arcs.join('')}
    <text x="${cx}" y="${cy - 8}" text-anchor="middle" font-family="Inter,sans-serif" font-size="30" font-weight="700" fill="#f0f4ff">${stats.totalUsers ?? 0}</text>
    <text x="${cx}" y="${cy + 12}" text-anchor="middle" font-family="Inter,sans-serif" font-size="10.5" fill="#4b5c78" letter-spacing="0.3">Total Users</text>
  `;

  legend.innerHTML = segs.map(s => `
    <div class="donut-legend-item">
      <div class="donut-legend-dot" style="background:${s.color}"></div>
      <span class="donut-legend-label">${s.label}</span>
      <span class="donut-legend-val">${s.val}</span>
    </div>
  `).join('');
}

async function loadStats() {
  try {
    const d = await AdminFetch.getStats();
    if (!d) return;

    drawDonut(d);

    document.getElementById('stat-files').textContent   = d.totalFiles ?? 0;
    document.getElementById('stat-ws').textContent      = d.totalWorkspaces ?? 0;
    document.getElementById('stat-storage').textContent = (d.globalTotalSize_GB ?? '0') + ' GB';
    document.getElementById('stat-week').textContent    = d.newUsersWeek ?? 0;
  } catch(e) {
    toast('Failed to load stats: ' + e.message, 'error');
  }
}

function toggleUserSelect(id, checked, e) {
  e.stopPropagation();
  checked ? _selUsers.add(id) : _selUsers.delete(id);
  document.getElementById(`urow-${id}`)?.classList.toggle('row-selected', checked);
  updateUsersBulkBtn();
}

function toggleSelectAllUsers(checked) {
  document.querySelectorAll('.user-row-check').forEach(cb => {
    cb.checked = checked;
    const id = Number(cb.dataset.id);
    checked ? _selUsers.add(id) : _selUsers.delete(id);
    document.getElementById(`urow-${id}`)?.classList.toggle('row-selected', checked);
  });
  updateUsersBulkBtn();
}

function updateUsersBulkBtn() {
  const btn = document.getElementById('bulk-delete-users-btn');
  if (!btn) return;
  const n = _selUsers.size;
  btn.disabled = n === 0;
  btn.classList.toggle('active', n > 0);
  btn.querySelector('span').textContent = n > 0 ? `Delete (${n})` : 'Delete';
}

async function bulkDeleteUsers() {
  if (!_selUsers.size) return;
  const n = _selUsers.size;
  const ok = await adminConfirm(`Permanently delete ${n} user${n > 1 ? 's' : ''} and all their data? This cannot be undone.`);
  if (!ok) return;
  let done = 0, fail = 0;
  for (const id of [..._selUsers]) {
    try { await AdminFetch.deleteUser(id); done++; }
    catch { fail++; }
  }
  _selUsers.clear();
  updateUsersBulkBtn();
  toast(`${done} user${done !== 1 ? 's' : ''} deleted${fail ? `, ${fail} failed` : ''}`, done > 0 ? 'success' : 'error');
  loadStats();
  loadUsers(_page);
}

async function loadUsers(page = 1) {
  _page = page;
  _selUsers.clear();
  updateUsersBulkBtn();
  const selAll = document.getElementById('sel-all-users');
  if (selAll) selAll.checked = false;
  const tbody = document.getElementById('users-tbody');
  tbody.innerHTML = '<tr><td colspan="8" class="table-empty"><div class="spin-wrap"><div class="spinner"></div></div></td></tr>';

  try {
    const result = await AdminFetch.getUsers(page, 25, _filters);
    if (!result) return;

    document.getElementById('users-count').textContent = `${result.total} user${result.total !== 1 ? 's' : ''}`;

    if (!result.data.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="table-empty">No users match the current filters</td></tr>';
      renderPagination(1, 1);
      return;
    }

    tbody.innerHTML = result.data.map(u => {
      const pct = u.storageLimit ? Math.min(100, (u.usedStorage / u.storageLimit * 100)).toFixed(0) : 0;
      const barCls = pct >= 90 ? 'danger' : pct >= 70 ? 'warn' : '';
      const av = u.profile_photo
        ? `<div class="user-cell-av"><img src="${_e(u.profile_photo)}" alt="" /></div>`
        : `<div class="user-cell-av" style="background:linear-gradient(135deg,#2563eb,#7c3aed)">${_e((u.name || '?').charAt(0).toUpperCase())}</div>`;
      return `<tr id="urow-${u.user_id}" onclick="goToUser(${u.user_id})">
        <td class="td-check" onclick="event.stopPropagation()"><input type="checkbox" class="user-row-check" data-id="${u.user_id}" onchange="toggleUserSelect(${u.user_id},this.checked,event)" /></td>
        <td class="td-id">#${u.user_id}</td>
        <td><div class="user-cell">${av}<span class="td-name">${_e(u.name)}</span></div></td>
        <td class="td-muted">${_e(u.email)}</td>
        <td class="td-muted">${fmtDate(u.created_at)}</td>
        <td>${u.fileCount ?? 0}</td>
        <td>
          <div class="storage-mini">
            <span class="storage-mini-text">${fmtBytes(u.usedStorage)}</span>
            <div class="storage-bar"><div class="storage-bar-fill ${barCls}" style="width:${pct}%"></div></div>
          </div>
        </td>
        <td>${u.workspaceCount ?? 0}</td>
      </tr>`;
    }).join('');

    renderPagination(page, result.totalPages);
  } catch(e) {
    tbody.innerHTML = '<tr><td colspan="7" class="table-empty">Failed to load users</td></tr>';
    toast('Failed: ' + e.message, 'error');
  }
}

function goToUser(id) {
  window.location.href = './user-detail?id=' + id;
}

function renderPagination(page, totalPages) {
  const el = document.getElementById('users-pagination');
  if (!el) return;
  if (totalPages <= 1) { el.innerHTML = ''; return; }

  const s = Math.max(1, page - 2);
  const e = Math.min(totalPages, page + 2);
  const parts = [];
  if (s > 1)          { parts.push(1); if (s > 2) parts.push('…'); }
  for (let i = s; i <= e; i++) parts.push(i);
  if (e < totalPages) { if (e < totalPages - 1) parts.push('…'); parts.push(totalPages); }

  el.innerHTML =
    `<button class="pg-btn" onclick="loadUsers(${page - 1})" ${page <= 1 ? 'disabled' : ''}>‹</button>` +
    parts.map(p => p === '…'
      ? `<span class="pg-dots">…</span>`
      : `<button class="pg-btn${p === page ? ' active' : ''}" onclick="loadUsers(${p})">${p}</button>`
    ).join('') +
    `<button class="pg-btn" onclick="loadUsers(${page + 1})" ${page >= totalPages ? 'disabled' : ''}>›</button>`;
}

function openFilterModal() {
  const f = _filters;
  openModal(`
    <div class="modal-header">
      <div class="modal-header-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
      </div>
      <div><div class="modal-header-title">Filter Users</div></div>
      <button class="modal-close" onclick="closeModal()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </div>
    <div class="modal-body">

      <div class="filter-section">
        <div class="filter-section-label">Date Joined</div>
        <div class="pill-group" id="f-date-group">
          <button class="pill ${!f.dateFilter ? 'active' : ''}"       onclick="filterPill('f-date-group',this)"       data-val="">All time</button>
          <button class="pill ${f.dateFilter==='today' ? 'active':''}" onclick="filterPill('f-date-group',this)" data-val="today">Today</button>
          <button class="pill ${f.dateFilter==='week'  ? 'active':''}" onclick="filterPill('f-date-group',this)"  data-val="week">This week</button>
          <button class="pill ${f.dateFilter==='month' ? 'active':''}" onclick="filterPill('f-date-group',this)" data-val="month">This month</button>
        </div>
      </div>

      <div class="filter-section">
        <div class="filter-section-label">Workspace Count</div>
        <div class="filter-row">
          <div class="form-group" style="margin:0">
            <label class="form-label">Min workspaces</label>
            <input class="form-input" type="number" id="f-min-ws" min="0" placeholder="0" value="${f.minWorkspaces ?? ''}" />
          </div>
          <div class="form-group" style="margin:0">
            <label class="form-label">Max workspaces</label>
            <input class="form-input" type="number" id="f-max-ws" min="0" placeholder="Any" value="${f.maxWorkspaces ?? ''}" />
          </div>
        </div>
      </div>

      <div class="filter-section">
        <div class="filter-section-label">Has Files</div>
        <div class="pill-group" id="f-files-group">
          <button class="pill ${!f.hasFiles ? 'active':''}"         onclick="filterPill('f-files-group',this)"    data-val="">Any</button>
          <button class="pill ${f.hasFiles==='yes' ? 'active':''}"  onclick="filterPill('f-files-group',this)" data-val="yes">Yes</button>
          <button class="pill ${f.hasFiles==='no' ? 'active':''}"   onclick="filterPill('f-files-group',this)"  data-val="no">No</button>
        </div>
      </div>

    </div>
    <div class="modal-footer split">
      <button class="btn btn-ghost" onclick="clearFilters()">Clear all</button>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="applyFilters()">Apply</button>
      </div>
    </div>
  `);
}

function filterPill(groupId, el) {
  document.querySelectorAll(`#${groupId} .pill`).forEach(p => p.classList.remove('active'));
  el.classList.add('active');
}

function applyFilters() {
  const minWs = document.getElementById('f-min-ws')?.value;
  const maxWs = document.getElementById('f-max-ws')?.value;

  const dateGroup  = document.querySelector('#f-date-group .pill.active');
  const filesGroup = document.querySelector('#f-files-group .pill.active');

  _filters = {};
  if (dateGroup?.dataset.val)  _filters.dateFilter    = dateGroup.dataset.val;
  if (filesGroup?.dataset.val) _filters.hasFiles      = filesGroup.dataset.val;
  if (minWs)                   _filters.minWorkspaces = minWs;
  if (maxWs)                   _filters.maxWorkspaces = maxWs;

  const search = document.getElementById('search-input')?.value.trim();
  if (search) _filters.search = search;

  closeModal();
  updateFilterDot();
  loadUsers(1);
}

function clearFilters() {
  _filters = {};
  const search = document.getElementById('search-input');
  if (search) search.value = '';
  window._pendingFilters = {};
  closeModal();
  updateFilterDot();
  loadUsers(1);
}

function updateFilterDot() {
  const dot = document.getElementById('filter-dot');
  if (!dot) return;
  const active = Object.values(_filters).some(v => v !== undefined && v !== '');
  dot.classList.toggle('active', active);
}

(function init() {
  const p = getPayload();
  if (!p || (p.role !== 'super' && p.role !== 'editor' && p.role !== 'viewer')) {
    adminOut();
    return;
  }

  initTheme();

  const nameEl   = document.getElementById('admin-name');
  const roleEl   = document.getElementById('admin-role');
  const avatarEl = document.getElementById('admin-avatar');
  if (nameEl)   nameEl.textContent   = p.username || p.name || p.email || 'Admin';
  if (roleEl)   roleEl.textContent   = p.role;
  if (avatarEl) avatarEl.textContent = (p.username || p.name || p.email || 'A').charAt(0).toUpperCase();

  document.getElementById('theme-btn')?.addEventListener('click', toggleTheme);
  document.getElementById('logout-btn')?.addEventListener('click', adminOut);
  document.getElementById('filter-btn')?.addEventListener('click', openFilterModal);

  document.getElementById('refresh-btn')?.addEventListener('click', () => {
    loadStats();
    loadUsers(_page);
  });

  document.getElementById('search-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const val = e.target.value.trim();
      if (val) _filters.search = val;
      else delete _filters.search;
      updateFilterDot();
      loadUsers(1);
    }
  });

  loadStats();
  loadUsers(1);
})();
