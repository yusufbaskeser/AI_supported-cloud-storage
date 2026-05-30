let isWaiting = false;

document.addEventListener('DOMContentLoaded', () => {
  initApp();

  const user = getAppUser();
  if (user?.username) {
    document.getElementById('chatWelcomeName').textContent = user.username;
  }

  const input = document.getElementById('chatInput');
  input.style.height = '21px';
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 140) + 'px';
    scrollBottom();
  });
});

function setOrbState(state) {
  const orb = document.getElementById('chatOrb');
  if (!orb) return;
  orb.className = 'orb' + (state !== 'idle' ? ` orb--${state}` : '');
}

function sendSuggestion(btn) {
  const input = document.getElementById('chatInput');
  const titleEl = btn.querySelector('.chat-suggestion-title');
  input.value = titleEl ? titleEl.textContent.trim() : btn.textContent.trim();
  sendMessage();
}

async function sendMessage() {
  if (isWaiting) return;
  const input = document.getElementById('chatInput');
  const text  = input.value.trim();
  if (!text) return;

  document.getElementById('chatWelcome')?.remove();

  appendUserMsg(text);
  input.value = '';
  input.style.height = '21px';

  isWaiting = true;
  document.getElementById('chatSendBtn').disabled = true;
  setOrbState('thinking');

  const typingId = appendTyping();

  const timeout = setTimeout(() => {
    setTypingStatus(typingId, 'This is taking longer than usual…');
  }, 15000);

  try {
    const data = await sendChatMessage(text);
    clearTimeout(timeout);
    removeTyping(typingId);
    setOrbState('responding');
    if (data.toast) showToast(data.toast);
    await appendAiMsg(data);
    setTimeout(() => setOrbState('idle'), 1800);
  } catch (err) {
    clearTimeout(timeout);
    removeTyping(typingId);
    setOrbState('idle');
    await appendAiMsg({ reply: err.message || 'Could not reach the server. Check your connection.', action: 'general' });
  }

  isWaiting = false;
  document.getElementById('chatSendBtn').disabled = false;
  document.getElementById('chatInput').focus();
}

function appendTyping() {
  const msgs = document.getElementById('chatMessages');
  const wrapper = document.createElement('div');
  wrapper.className = 'chat-msg ai';
  const id = 'typing-' + Date.now();
  wrapper.id = id;
  wrapper.innerHTML = `
    <div class="chat-ai-row">
      <div class="orb orb-sm orb--thinking"></div>
      <div class="chat-typing-wrap">
        <div class="chat-typing-dots"><span></span><span></span><span></span></div>
        <span class="chat-typing-status"></span>
      </div>
    </div>`;
  msgs.appendChild(wrapper);
  scrollBottom();
  return id;
}

function setTypingStatus(id, text) {
  const el = document.getElementById(id);
  if (el) {
    const s = el.querySelector('.chat-typing-status');
    if (s) s.textContent = text;
  }
}

function removeTyping(id) {
  document.getElementById(id)?.remove();
}

function appendUserMsg(text) {
  const msgs = document.getElementById('chatMessages');
  const el   = document.createElement('div');
  el.className = 'chat-msg user';
  el.innerHTML = `
    <div class="chat-bubble">${escapeHtml(text)}</div>
    <span class="chat-msg-time">${nowTime()}</span>`;
  msgs.appendChild(el);
  scrollBottom();
}

async function appendAiMsg(data) {
  const { reply, files, stats, action, workspace_id, workspace_name } = data;
  const msgs = document.getElementById('chatMessages');
  const el   = document.createElement('div');
  el.className = 'chat-msg ai';

  let extra = '';

  if (action === 'generate_link' && files?.length > 0) {
    const file = files[0];
    try {
      const shareData = await fetchFileShareUrl(file.file_id, 1800);
      const url = shareData.url;
      const expireTime = new Date(shareData.expires_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      extra = `
        <div class="chat-share-box">
          <div class="chat-share-header">
            <div class="chat-share-icon">${fileTypeSvg(file.mime_type)}</div>
            <span class="chat-share-filename">${escapeHtml(file.filename)}</span>
          </div>
          <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="chat-share-link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            Click to open file
          </a>
          <div class="chat-share-footer">
            <button class="chat-share-copy" onclick="chatCopyText('${escapeHtml(url)}', this)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              Copy link
            </button>
            <span class="chat-share-expiry">Expires at ${expireTime}</span>
          </div>
        </div>`;
    } catch {
      extra = '<p class="chat-share-err">Could not generate link — please try again.</p>';
    }

  } else if (action === 'delete_files') {
    extra = buildDeleteFilesConfirm(files || []);

  } else if (action === 'delete_workspace') {
    extra = buildDeleteWorkspaceConfirm(workspace_id, workspace_name, files || []);

  } else if (files !== undefined) {
    extra = await buildFileTiles(files);
  }

  if (stats && typeof stats === 'object') {
    const statMeta = {
      total_files:    { icon: '📁', cls: 'blue' },
      total_size_mb:  { icon: '💾', cls: 'purple' },
      largest_file:   { icon: '📌', cls: 'green' },
      most_used_tags: { icon: '🏷️', cls: 'amber' },
    };
    const entries = Object.entries(stats).slice(0, 4);
    const cards = entries.map(([k, v]) => {
      const m = statMeta[k] || { icon: '📊', cls: '' };
      const val = Array.isArray(v) ? v.slice(0, 3).join(', ') || '—' : escapeHtml(String(v));
      return `
        <div class="chat-stat-card${m.cls ? ` chat-stat-card--${m.cls}` : ''}">
          <div class="chat-stat-icon">${m.icon}</div>
          <div class="chat-stat-value">${val}</div>
          <div class="chat-stat-label">${escapeHtml(formatStatKey(k))}</div>
        </div>`;
    }).join('');
    extra += `<div class="chat-stats-grid">${cards}</div>`;
  }

  el.innerHTML = `
    <div class="chat-ai-row">
      <div class="orb orb-sm"></div>
      <div class="chat-bubble">
        <div class="chat-md">${renderMarkdown(reply)}</div>
        ${extra}
      </div>
    </div>
    <span class="chat-msg-time" style="padding-left:38px;">${nowTime()}</span>`;
  msgs.appendChild(el);
  scrollBottom();
}

async function buildFileTiles(files) {
  if (!files?.length) {
    return files !== null && files !== undefined
      ? '<p class="chat-files-empty">No files found for this search.</p>'
      : '';
  }

  const MAX_TILES   = 20;
  const MAX_IMG_PRE = 6;
  const visible     = files.slice(0, MAX_TILES);
  let imgCount      = 0;

  const tiles = await Promise.all(visible.map(async f => {
    const isImg = f.mime_type?.startsWith('image/');
    const name  = f.filename || 'File';
    const id    = f.file_id;
    let imgHtml   = '';
    let cachedUrl = '';

    if (isImg && imgCount < MAX_IMG_PRE) {
      imgCount++;
      try {
        const data = await fetchFileDownloadUrl(id);
        cachedUrl = typeof data === 'string' ? data : data.url;
        imgHtml = `<img src="${escapeHtml(cachedUrl)}" alt="${escapeHtml(name)}" class="chat-tile-img" loading="lazy">`;
      } catch {
        imgHtml = `<div class="chat-tile-icon">${fileTypeSvg(f.mime_type)}</div>`;
      }
    } else {
      imgHtml = `<div class="chat-tile-icon">${fileTypeSvg(f.mime_type)}</div>`;
    }

    return `
      <div class="chat-file-tile" data-file-id="${id}" data-cached-url="${escapeHtml(cachedUrl)}">
        <div class="chat-tile-body">
          ${imgHtml}
          <div class="chat-tile-overlay">
            <button class="chat-tile-btn" title="Open in new tab"
              onclick="event.stopPropagation(); chatTileOpen(this.closest('.chat-file-tile'))">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </button>
            <button class="chat-tile-btn" title="Copy link (30 min)"
              onclick="event.stopPropagation(); chatTileCopyLink(${id}, this)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            </button>
            <button class="chat-tile-btn" title="Download"
              onclick="event.stopPropagation(); chatTileDownload(${id})">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </button>
          </div>
        </div>
        <div class="chat-tile-name" title="${escapeHtml(name)}">${escapeHtml(name)}</div>
      </div>`;
  }));

  const more  = files.length > MAX_TILES ? `<p class="chat-files-more">+${files.length - MAX_TILES} more files</p>` : '';
  const badge = `<div class="chat-files-badge">${files.length} file${files.length !== 1 ? 's' : ''} found</div>`;
  return `${badge}<div class="chat-files-grid">${tiles.join('')}</div>${more}`;
}

async function chatTileOpen(tile) {
  let url = tile.dataset.cachedUrl;
  if (!url) {
    try {
      const data = await fetchFileDownloadUrl(Number(tile.dataset.fileId));
      url = typeof data === 'string' ? data : data.url;
      tile.dataset.cachedUrl = url;
    } catch { return; }
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

async function chatTileCopyLink(fileId, btn) {
  try {
    const data = await fetchFileShareUrl(fileId, 1800);
    await navigator.clipboard.writeText(data.url);
    const svg = btn.innerHTML;
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    btn.classList.add('chat-tile-btn--ok');
    setTimeout(() => { btn.innerHTML = svg; btn.classList.remove('chat-tile-btn--ok'); }, 2000);
  } catch {}
}

async function chatTileDownload(fileId) {
  try {
    const data = await fetchFileDirectDownloadUrl(fileId);
    const url = typeof data === 'string' ? data : data.url;
    const a = Object.assign(document.createElement('a'), { href: url, download: '' });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch {}
}

function buildDeleteFilesConfirm(files) {
  if (!files.length) return '<p class="chat-files-empty">No matching files found.</p>';
  const ids = files.map(f => f.file_id);
  const rows = files.map(f => `
    <div class="chat-del-row">
      <div class="chat-del-icon">${fileTypeSvg(f.mime_type)}</div>
      <span class="chat-del-name" title="${escapeHtml(f.filename)}">${escapeHtml(f.filename)}</span>
      <span class="chat-del-size">${formatBytes(f.size || 0)}</span>
    </div>`).join('');
  return `
    <div class="chat-confirm-box" id="delConfirm-${ids[0]}">
      <div class="chat-confirm-header">
        <svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        <span>${files.length} file${files.length !== 1 ? 's' : ''} will be deleted permanently</span>
      </div>
      <div class="chat-del-list">${rows}</div>
      <div class="chat-confirm-actions">
        <button class="btn-app-ghost chat-confirm-cancel" onclick="this.closest('.chat-confirm-box').remove()">Cancel</button>
        <button class="btn-danger chat-confirm-del" onclick="chatConfirmDeleteFiles([${ids.join(',')}], this)">Delete ${files.length} file${files.length !== 1 ? 's' : ''}</button>
      </div>
    </div>`;
}

function buildDeleteWorkspaceConfirm(workspaceId, workspaceName, files) {
  const safeWs = escapeHtml(workspaceName || 'this workspace');
  return `
    <div class="chat-confirm-box" id="wsConfirm-${workspaceId}">
      <div class="chat-confirm-header">
        <svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        <span>Delete workspace <strong>${safeWs}</strong> and its ${files.length} file${files.length !== 1 ? 's' : ''}?</span>
      </div>
      <div class="chat-confirm-actions">
        <button class="btn-app-ghost chat-confirm-cancel" onclick="this.closest('.chat-confirm-box').remove()">Cancel</button>
        <button class="btn-danger chat-confirm-del" onclick="chatConfirmDeleteWorkspace(${workspaceId}, '${safeWs}', this)">Delete Workspace</button>
      </div>
    </div>`;
}

async function chatConfirmDeleteFiles(fileIds, btn) {
  btn.disabled = true;
  btn.textContent = 'Deleting...';
  try {
    await deleteFiles(fileIds);
    const box = btn.closest('.chat-confirm-box');
    box.innerHTML = '<p style="color:var(--text-muted);font-size:0.84rem;padding:8px 0;">Files deleted.</p>';
    showToast(`${fileIds.length} file${fileIds.length !== 1 ? 's' : ''} deleted.`, 'success');
  } catch (err) {
    showToast(err.message || 'Failed to delete files.', 'error');
    btn.disabled = false;
    btn.textContent = `Delete ${fileIds.length} file${fileIds.length !== 1 ? 's' : ''}`;
  }
}

async function chatConfirmDeleteWorkspace(workspaceId, workspaceName, btn) {
  btn.disabled = true;
  btn.textContent = 'Deleting...';
  try {
    const res = await apiCall('DELETE', `/workspaces/${workspaceId}`);
    if (!res?.ok) throw new Error(await extractError(res));
    const box = btn.closest('.chat-confirm-box');
    box.innerHTML = `<p style="color:var(--text-muted);font-size:0.84rem;padding:8px 0;">Workspace "${workspaceName}" deleted.</p>`;
    showToast(`Workspace "${workspaceName}" deleted.`, 'success');
  } catch (err) {
    showToast(err.message || 'Failed to delete workspace.', 'error');
    btn.disabled = false;
    btn.textContent = 'Delete Workspace';
  }
}

function chatCopyText(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.innerHTML;
    btn.textContent = '✓ Copied!';
    btn.style.color = 'var(--accent)';
    setTimeout(() => { btn.innerHTML = orig; btn.style.color = ''; }, 2000);
  }).catch(() => {});
}

function clearChat() {
  const user = getAppUser();
  const name = user?.username || 'there';
  const msgs = document.getElementById('chatMessages');
  msgs.innerHTML = `
    <div class="chat-welcome" id="chatWelcome">
      <div class="orb" id="chatOrb"></div>
      <div class="chat-welcome-copy">
        <h1 class="chat-welcome-name">Hello, <span>${escapeHtml(name)}</span></h1>
        <p class="chat-welcome-sub">Ask me anything about your files and workspaces.</p>
      </div>
      <div class="chat-suggestions">
        <button class="chat-suggestion" onclick="sendSuggestion(this)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
          <div class="chat-suggestion-text">
            <span class="chat-suggestion-title">What files do I have?</span>
            <span class="chat-suggestion-sub">Browse all your uploads</span>
          </div>
        </button>
        <button class="chat-suggestion" onclick="sendSuggestion(this)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
          <div class="chat-suggestion-text">
            <span class="chat-suggestion-title">Show my storage stats</span>
            <span class="chat-suggestion-sub">Size, count &amp; top tags</span>
          </div>
        </button>
        <button class="chat-suggestion" onclick="sendSuggestion(this)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <div class="chat-suggestion-text">
            <span class="chat-suggestion-title">Find my recent uploads</span>
            <span class="chat-suggestion-sub">Your latest files</span>
          </div>
        </button>
        <button class="chat-suggestion" onclick="sendSuggestion(this)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          <div class="chat-suggestion-text">
            <span class="chat-suggestion-title">List my workspaces</span>
            <span class="chat-suggestion-sub">See all your folders</span>
          </div>
        </button>
      </div>
    </div>`;
}

function scrollBottom() {
  const main = document.querySelector('.chat-main');
  if (main) main.scrollTop = main.scrollHeight;
}

function nowTime() {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatStatKey(key) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
