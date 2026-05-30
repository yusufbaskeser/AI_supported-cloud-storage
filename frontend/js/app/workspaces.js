const MIME_COLORS = {
  pdf:          '#ef4444',
  word:         '#3b82f6',
  excel:        '#22c55e',
  powerpoint:   '#f59e0b',
  image:        '#a855f7',
  video:        '#f97316',
  audio:        '#ec4899',
  code:         '#14b8a6',
  archive:      '#8b5cf6',
  default:      '#2563eb',
};

const EXT_TAG_MAP = {
  ts:'TypeScript', tsx:'TypeScript', js:'JavaScript', jsx:'JavaScript',
  py:'Python', java:'Java', go:'Go', rb:'Ruby', php:'PHP',
  cs:'C#', cpp:'C++', c:'C', sql:'SQL', json:'JSON',
  yaml:'YAML', yml:'YAML', md:'Markdown', html:'HTML', css:'CSS',
  pdf:'PDF', png:'Image', jpg:'Image', jpeg:'Image', gif:'Image',
  svg:'SVG', mp4:'Video', avi:'Video', mp3:'Audio', wav:'Audio',
  zip:'Archive', tar:'Archive', gz:'Archive',
};

function mimeCategory(mime) {
  if (!mime) return 'default';
  if (mime.includes('pdf')) return 'pdf';
  if (mime.includes('word') || mime.includes('document')) return 'word';
  if (mime.includes('sheet') || mime.includes('excel')) return 'excel';
  if (mime.includes('presentation') || mime.includes('powerpoint')) return 'powerpoint';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('text/') || mime.includes('javascript') || mime.includes('json')) return 'code';
  if (mime.includes('zip') || mime.includes('tar') || mime.includes('rar')) return 'archive';
  return 'default';
}

function getDominantColor(files) {
  if (!files.length) return MIME_COLORS.default;
  const counts = {};
  files.forEach(f => {
    const cat = mimeCategory(f.mime_type);
    counts[cat] = (counts[cat] || 0) + 1;
  });
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  return MIME_COLORS[top] || MIME_COLORS.default;
}

function getWorkspaceTags(files) {
  const aiTags = [...new Set(files.flatMap(f => f.tags || []))];
  if (aiTags.length >= 2) return aiTags.slice(0, 4);
  const extTags = new Set();
  files.forEach(f => {
    const ext = (f.filename.split('.').pop() || '').toLowerCase();
    const tag = EXT_TAG_MAP[ext];
    if (tag) extTags.add(tag);
  });
  return [...extTags].slice(0, 4);
}

document.addEventListener('DOMContentLoaded', async () => {
  initApp();
  showPageLoader();
  SynapseParticles.initHero('ws-particles');

  const user = getAppUser();
  if (user) {
    const name = user.username || user.email?.split('@')[0] || 'there';
    document.getElementById('wsUserName').textContent = name;

    const avatar = document.getElementById('wsHeroAvatar');
    if (avatar) {
      avatar.textContent = name.charAt(0).toUpperCase();
      const cached = localStorage.getItem('sc-profile-photo');
      if (cached) {
        avatar.innerHTML = `<img src="${cached}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`;
      }
    }
  }

  document.getElementById('createBtn').addEventListener('click', openCreateModal);
  await loadWorkspaces();
  hidePageLoader();
});

async function loadWorkspaces() {
  try {
    const workspaces = await fetchWorkspaces();

    if (!workspaces.length) {
      buildAiBanner([], {});
      renderEmpty();
      return;
    }

    const filesMap = {};
    await Promise.all(workspaces.map(async ws => {
      try { filesMap[ws.workspace_id] = (await fetchFiles(ws.workspace_id)).data ?? []; }
      catch { filesMap[ws.workspace_id] = []; }
    }));

    buildAiBanner(workspaces, filesMap);
    renderWorkspaces(workspaces, filesMap);
    renderTagCloud(filesMap);
  } catch {
    showToast('Failed to load workspaces.', 'error');
  }
}

function renderTagCloud(filesMap) {
  const section = document.getElementById('wsTagCloudSection');
  const cloud   = document.getElementById('wsTagCloud');
  const countEl = document.getElementById('wsTagCount');

  const tagCounts = {};
  Object.values(filesMap).flat().forEach(f => {
    (f.tags || []).forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; });
  });

  if (!Object.keys(tagCounts).length) {
    Object.values(filesMap).flat().forEach(f => {
      const ext = (f.filename.split('.').pop() || '').toLowerCase();
      const tag = EXT_TAG_MAP[ext];
      if (tag) tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  }

  const entries = Object.entries(tagCounts);
  if (!entries.length) { section.style.display = 'none'; return; }

  section.style.display = 'block';
  countEl.textContent = `${entries.length} unique tag${entries.length !== 1 ? 's' : ''}`;

  const counts  = entries.map(([, c]) => c);
  const minC    = Math.min(...counts);
  const maxC    = Math.max(...counts);
  const minSize = 0.78;
  const maxSize = 1.65;
  const palette = Object.values(MIME_COLORS);

  cloud.innerHTML = entries
    .sort((a, b) => b[1] - a[1])
    .map(([tag, count], i) => {
      const size  = minSize + ((count - minC) / (maxC - minC || 1)) * (maxSize - minSize);
      const color = palette[i % palette.length];
      return `<span class="ws-cloud-tag" style="font-size:${size.toFixed(2)}rem;color:${color};background:${color}16;" title="${count} file${count !== 1 ? 's' : ''}">#${escapeHtml(tag)}</span>`;
    }).join('');
}

function buildAiBanner(workspaces, filesMap) {
  const user = getAppUser();
  const name = user?.username || 'there';
  const count = workspaces.length;
  const allFiles = Object.values(filesMap).flat();
  const totalFiles = allFiles.length;

  let msg;
  if (!count) {
    msg = `Hey ${name}, you don't have any workspaces yet. Create your first one to get started.`;
  } else {
    const sorted = [...allFiles].sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at));
    const latest = sorted[0];
    const ws = count !== 1 ? 's' : '';
    const fs = totalFiles !== 1 ? 's' : '';
    if (latest) {
      msg = `You have ${count} active workspace${ws} with ${totalFiles} file${fs} total. Latest upload was ${relativeTime(latest.uploaded_at)}.`;
    } else {
      msg = `You have ${count} active workspace${ws}. Upload files to let AI analyze and tag them automatically.`;
    }
  }

  document.getElementById('wsAiText').textContent = msg;
}

function renderEmpty() {
  document.getElementById('workspacesGrid').innerHTML = `
    <div class="empty-state" style="grid-column:1/-1;">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
      <div class="empty-state-title">No workspaces yet</div>
      <div class="empty-state-desc">Create your first workspace to start organizing your files with AI.</div>
    </div>`;
}

function renderWorkspaces(workspaces, filesMap) {
  const grid = document.getElementById('workspacesGrid');

  grid.innerHTML = workspaces.map(ws => {
    const files = filesMap[ws.workspace_id] || [];
    const color = getDominantColor(files);
    const tags = getWorkspaceTags(files);
    const fileCount = files.length;
    const progressPct = Math.min(100, Math.round((fileCount / 10) * 100));
    const sorted = [...files].sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at));
    const lastActivity = sorted[0] ? relativeTime(sorted[0].uploaded_at) : 'No activity';

    const tagsHtml = tags.length
      ? `<div class="ws-tags">${tags.map(t => `<span class="ws-tag" style="color:${color};background:${color}18;">#${escapeHtml(t)}</span>`).join('')}</div>`
      : '';

    return `
      <div class="ws-card">
        <div class="ws-card-accent" style="background:${color};"></div>

        <div class="ws-card-top">
          <div class="ws-card-icon" style="background:${color}18; color:${color};">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          </div>
          <div class="ws-menu-wrap">
            <button class="ws-menu-btn" onclick="toggleMenu(event,'${ws.workspace_id}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
            </button>
            <div class="ws-dropdown" id="drop-${ws.workspace_id}" style="display:none;">
              <button onclick="openRenameModal(${ws.workspace_id},'${escapeHtml(ws.name)}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Rename
              </button>
              <button class="danger" onclick="confirmDelete(${ws.workspace_id},'${escapeHtml(ws.name)}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                Delete
              </button>
            </div>
          </div>
        </div>

        <a href="workspace-files?id=${ws.workspace_id}" class="ws-card-body">
          <div class="ws-name">${escapeHtml(ws.name)}</div>
          <div class="ws-desc">${escapeHtml(ws.description || 'No description')}</div>
          ${tagsHtml}
        </a>

        <div class="ws-card-footer">
          <div class="ws-footer-row">
            <span class="ws-last-active">${lastActivity}</span>
            <span class="ws-file-count">${fileCount} file${fileCount !== 1 ? 's' : ''}</span>
          </div>
          <div class="ws-progress-track">
            <div class="ws-progress-fill" style="width:${progressPct}%; background:${color};"></div>
          </div>
        </div>
      </div>`;
  }).join('');
}

function toggleMenu(e, id) {
  e.stopPropagation();
  closeAllMenus();
  const d = document.getElementById(`drop-${id}`);
  if (d) d.style.display = 'block';
}

function closeAllMenus() {
  document.querySelectorAll('.ws-dropdown').forEach(d => d.style.display = 'none');
}

document.addEventListener('click', closeAllMenus);

function openCreateModal() {
  openModal(`
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">New Workspace</div>
        <button class="modal-close" onclick="closeModal()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Name</label>
          <input type="text" id="wsName" class="form-input" placeholder="e.g. My Project" />
        </div>
        <div class="form-group">
          <label class="form-label">Description <span style="color:var(--text-muted);font-weight:400">(optional)</span></label>
          <input type="text" id="wsDesc" class="form-input" placeholder="Short description" />
        </div>
        <div class="form-status" id="wsStatus"></div>
      </div>
      <div class="modal-footer">
        <button class="btn-app-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn-app-primary" id="wsCreateBtn" onclick="handleCreate()">Create</button>
      </div>
    </div>`);
  setTimeout(() => document.getElementById('wsName')?.focus(), 60);
}

async function handleCreate() {
  const name   = document.getElementById('wsName')?.value.trim();
  const desc   = document.getElementById('wsDesc')?.value.trim();
  const btn    = document.getElementById('wsCreateBtn');
  const status = document.getElementById('wsStatus');
  if (!name) { showStatus(status, 'Name is required.', 'error'); return; }
  btn.disabled = true; btn.textContent = 'Creating...';
  try {
    await createWorkspace({ name, description: desc });
    closeModal(); showToast('Workspace created!', 'success'); await loadWorkspaces();
  } catch (err) {
    showStatus(status, err.message || 'Failed to create.', 'error');
    btn.disabled = false; btn.textContent = 'Create';
  }
}

function openRenameModal(id, currentName) {
  closeAllMenus();
  openModal(`
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">Rename Workspace</div>
        <button class="modal-close" onclick="closeModal()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">New name</label>
          <input type="text" id="wsRename" class="form-input" value="${escapeHtml(currentName)}" />
        </div>
        <div class="form-status" id="wsRenameStatus"></div>
      </div>
      <div class="modal-footer">
        <button class="btn-app-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn-app-primary" id="wsRenameBtn" onclick="handleRename(${id})">Save</button>
      </div>
    </div>`);
  setTimeout(() => document.getElementById('wsRename')?.focus(), 60);
}

async function handleRename(id) {
  const name   = document.getElementById('wsRename')?.value.trim();
  const btn    = document.getElementById('wsRenameBtn');
  const status = document.getElementById('wsRenameStatus');
  if (!name) { showStatus(status, 'Name cannot be empty.', 'error'); return; }
  btn.disabled = true; btn.textContent = 'Saving...';
  try {
    await updateWorkspace(id, { name });
    closeModal(); showToast('Renamed.', 'success'); await loadWorkspaces();
  } catch (err) {
    showStatus(status, err.message || 'Failed to rename.', 'error');
    btn.disabled = false; btn.textContent = 'Save';
  }
}

function confirmDelete(id, name) {
  closeAllMenus();
  openModal(`
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">Delete Workspace</div>
        <button class="modal-close" onclick="closeModal()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>
      <div class="modal-body">
        <p style="font-size:0.9rem;color:var(--text-sub);">Delete <strong>${escapeHtml(name)}</strong>? All files inside will be permanently removed.</p>
      </div>
      <div class="modal-footer">
        <button class="btn-app-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn-danger" id="wsDelBtn" onclick="handleDelete(${id})">Delete</button>
      </div>
    </div>`);
}

async function handleDelete(id) {
  const btn = document.getElementById('wsDelBtn');
  btn.disabled = true; btn.textContent = 'Deleting...';
  try { await deleteWorkspace(id); } catch {}
  closeModal(); showToast('Workspace deleted.', 'success'); await loadWorkspaces();
}
