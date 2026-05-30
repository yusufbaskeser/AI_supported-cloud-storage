const GREETINGS = [
  'Great day to organize your files,',
  'Your storage is safe and sound,',
  'Ready to take on the cloud,',
  'Everything is right where you left it,',
  'A new day, a fresh start,',
  'Your digital world is waiting,',
  "Let's make today productive,",
  'Your files are safer than ever,',
  'A perfect day for some cloud storage,',
  'Looking sharp in the cloud today,',
];

document.addEventListener('DOMContentLoaded', async () => {
  initApp();
  showPageLoader();
  SynapseParticles.initHero('dash-particles');
  SynapseParticles.initHero('cta-particles');

  const user = getAppUser();
  if (!user) { hidePageLoader(); return; }

  const greeting = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
  document.getElementById('dashGreeting').textContent = greeting;
  const displayName = localStorage.getItem('sc-display-name') || user.username || user.email?.split('@')[0] || 'there';
  document.getElementById('welcomeName').textContent = displayName;

  const heroAvatar = document.getElementById('dashHeroAvatar');
  if (heroAvatar) {
    const initial = displayName.charAt(0).toUpperCase();
    heroAvatar.textContent = initial;
    const cached = localStorage.getItem('sc-profile-photo');
    if (cached) {
      heroAvatar.innerHTML = `<img src="${cached}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`;
    }
  }

  const [wsResult, userResult] = await Promise.allSettled([
    fetchWorkspaces(),
    fetchUser(user.user_id),
  ]);

  const workspaces = wsResult.status === 'fulfilled' ? wsResult.value : [];
  const userData   = userResult.status === 'fulfilled' ? userResult.value : null;

  if (userData?.name) {
    updateNavDisplayName(userData.name);
    document.getElementById('welcomeName').textContent = userData.name;
    if (heroAvatar && !userData.profile_photo) {
      heroAvatar.textContent = userData.name.charAt(0).toUpperCase();
    }
  }

  if (userData?.profile_photo) {
    updateNavAvatar(userData.profile_photo);
    if (heroAvatar) {
      heroAvatar.innerHTML = `<img src="${userData.profile_photo}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`;
    }
  }

  renderStats(workspaces, userData);
  renderStorageOverview(workspaces, userData);
  renderRecentWorkspaces(workspaces);
  hidePageLoader();
});

function renderStats(workspaces, user) {
  const memberSince  = user ? formatDate(user.created_at) : '—';
  const usedStorage  = user ? Number(user.usedStorage)  : 0;
  const totalStorage = user ? Number(user.storageLimit) : 5368709120;
  const pct = totalStorage > 0 ? Math.round((usedStorage / totalStorage) * 100) : 0;
  const fillClass = pct > 90 ? 'danger' : pct > 70 ? 'warn' : '';
  const totalFiles = workspaces.reduce((s, w) => s + (w.file_count || w.files?.length || 0), 0);

  document.getElementById('dashStats').innerHTML = `
    <div class="dash-stat-card">
      <div class="dash-stat-icon blue">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
      </div>
      <div class="dash-stat-body">
        <div class="dash-stat-value">${workspaces.length}</div>
        <div class="dash-stat-label">Workspaces</div>
      </div>
    </div>
    <div class="dash-stat-card">
      <div class="dash-stat-icon green">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
      </div>
      <div class="dash-stat-body">
        <div class="dash-stat-value">${totalFiles}</div>
        <div class="dash-stat-label">Total Files</div>
      </div>
    </div>
    <div class="dash-stat-card">
      <div class="dash-stat-icon orange">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
      </div>
      <div class="dash-stat-body">
        <div class="dash-stat-value" style="font-size:1.1rem;">${formatBytes(usedStorage)} <span style="font-size:0.72rem;font-weight:400;color:var(--text-muted);">/ ${formatBytes(totalStorage)}</span></div>
        <div class="dash-stat-label">Storage Used</div>
        <div class="dash-storage-bar-wrap">
          <div class="dash-storage-bar-fill ${fillClass}" style="width:${pct}%;"></div>
        </div>
      </div>
    </div>
    <div class="dash-stat-card">
      <div class="dash-stat-icon purple">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      </div>
      <div class="dash-stat-body">
        <div class="dash-stat-value" style="font-size:0.95rem;">${memberSince}</div>
        <div class="dash-stat-label">Member Since</div>
      </div>
    </div>
  `;
}

function buildDonutSvg(pct, usedBytes) {
  const r    = 38;
  const circ = +(2 * Math.PI * r).toFixed(2);
  const visualPct = (pct === 0 && usedBytes > 0) ? 0.5 : pct;
  const fill = +((visualPct / 100) * circ).toFixed(2);
  const color    = pct > 90 ? '#ef4444' : pct > 70 ? '#f59e0b' : '#2563eb';
  const dotClass = pct > 90 ? 'danger' : pct > 70 ? 'warn' : 'blue';
  return { fill, circ, color, dotClass };
}

function renderStorageOverview(workspaces, user) {
  const usedStorage  = user ? Number(user.usedStorage)  : 0;
  const totalStorage = user ? Number(user.storageLimit) : 5368709120;
  const freeStorage  = Math.max(0, totalStorage - usedStorage);
  const pct        = totalStorage > 0 ? Math.round((usedStorage / totalStorage) * 100) : 0;
  const pctDisplay = totalStorage > 0 ? ((usedStorage / totalStorage) * 100).toFixed(1) : '0';
  const { fill, circ, color, dotClass } = buildDonutSvg(pct, usedStorage);

  document.getElementById('dashStorageGrid').innerHTML = `
    <div class="app-card dash-donut-card">
      <div class="dash-donut-svg-wrap">
        <svg viewBox="0 0 100 100" class="dash-donut-svg">
          <circle cx="50" cy="50" r="38" class="dash-donut-track"/>
          <circle cx="50" cy="50" r="38" class="dash-donut-arc"
            stroke="${color}"
            stroke-dasharray="${fill} ${circ}"
            stroke-dashoffset="0"/>
        </svg>
        <div class="dash-donut-center">
          <span class="dash-donut-pct">${pctDisplay}%</span>
          <span class="dash-donut-sub">used</span>
        </div>
      </div>
      <div class="dash-donut-legend">
        <div class="dash-legend-item">
          <span class="dash-legend-dot ${dotClass}"></span>
          <span>Used: <strong>${formatBytes(usedStorage)}</strong></span>
        </div>
        <div class="dash-legend-item">
          <span class="dash-legend-dot grey"></span>
          <span>Free: <strong>${formatBytes(freeStorage)}</strong></span>
        </div>
        <div class="dash-legend-item">
          <span class="dash-legend-dot purple"></span>
          <span>Limit: <strong>${formatBytes(totalStorage)}</strong></span>
        </div>
      </div>
    </div>
    <div class="app-card dash-ws-list-card">
      <h3 class="dash-ws-list-title">Workspaces — file count breakdown</h3>
      <div id="dashWsList">${renderWsList(workspaces)}</div>
    </div>
  `;
}

function renderWsList(workspaces) {
  if (!workspaces.length) {
    return `<div class="empty-state" style="padding:32px 0;">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="36" height="36"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
      <div class="empty-state-title" style="font-size:0.88rem;">No workspaces yet</div>
    </div>`;
  }

  const maxFiles = Math.max(...workspaces.map(w => w.file_count || w.files?.length || 0), 1);

  return workspaces.slice(0, 8).map(ws => {
    const count  = ws.file_count || ws.files?.length || 0;
    const barPct = Math.round((count / maxFiles) * 100);
    return `
      <a href="workspace-files?id=${ws.workspace_id}" class="dash-ws-list-item">
        <div class="dash-ws-list-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        </div>
        <div class="dash-ws-list-info">
          <div class="dash-ws-list-name">${escapeHtml(ws.name)}</div>
          <div class="dash-ws-list-meta">${count} file${count !== 1 ? 's' : ''} · ${formatDate(ws.created_at)}</div>
        </div>
        <div class="dash-ws-list-bar-wrap">
          <div class="dash-ws-list-bar-fill" style="width:${barPct}%;"></div>
        </div>
      </a>`;
  }).join('');
}

function renderRecentWorkspaces(workspaces) {
  const el = document.getElementById('recentWorkspaces');

  if (!workspaces.length) {
    el.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        <div class="empty-state-title">No workspaces yet</div>
        <div class="empty-state-desc">Create your first workspace to start organizing your files.</div>
        <a href="workspaces" class="btn-app-primary" style="margin-top:8px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Workspace
        </a>
      </div>`;
    return;
  }

  const recent = [...workspaces]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 6);

  el.innerHTML = recent.map(ws => `
    <a href="workspace-files?id=${ws.workspace_id}" class="dash-ws-card">
      <div class="dash-ws-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
      </div>
      <div class="dash-ws-info">
        <div class="dash-ws-name">${escapeHtml(ws.name)}</div>
        <div class="dash-ws-date">${formatDate(ws.created_at)}</div>
      </div>
      <svg class="dash-ws-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
    </a>`).join('');
}
