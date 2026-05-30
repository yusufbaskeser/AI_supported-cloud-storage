let workspaceId = null;
const selectedFiles = new Set();
let currentPage = 1;
let hasMoreFiles = false;

document.addEventListener('DOMContentLoaded', async () => {
  initApp();
  showPageLoader();

  const params = new URLSearchParams(window.location.search);
  workspaceId = params.get('id');
  if (!workspaceId) { hidePageLoader(); showToast('No workspace specified.', 'error'); return; }

  await Promise.all([loadWorkspace(), loadFiles()]);
  hidePageLoader();
  initDragDrop();

  document.getElementById('uploadBtnTop').addEventListener('click', () => {
    document.getElementById('fileInput').click();
  });
  document.getElementById('fileInput').addEventListener('change', e => {
    if (e.target.files.length) uploadFiles(e.target.files);
  });
});

function initDragDrop() {
  const overlay = document.getElementById('dropOverlay');

  document.addEventListener('dragenter', e => {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    overlay.classList.add('active');
  });

  document.addEventListener('dragleave', e => {
    if (e.clientX <= 0 || e.clientY <= 0 ||
        e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
      overlay.classList.remove('active');
    }
  });

  document.addEventListener('dragover', e => e.preventDefault());

  document.addEventListener('drop', e => {
    e.preventDefault();
    overlay.classList.remove('active');
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
  });
}

async function loadWorkspace() {
  try {
    const data = await fetchWorkspace(workspaceId);
    document.title = `${data.name || 'Workspace'} — SynapseCloud`;
  } catch {}
}

async function loadFiles() {
  currentPage = 1;
  hasMoreFiles = false;
  const container = document.getElementById('filesList');
  container.innerHTML = '<div class="skeleton" style="height:220px;border-radius:14px;"></div>';
  try {
    const result = await fetchFiles(workspaceId, 1);
    hasMoreFiles = result.hasMore;
    renderFiles(result.data);
  } catch {
    showToast('Failed to load files.', 'error');
    container.innerHTML = '';
  }
}

async function loadMoreFiles() {
  if (!hasMoreFiles) return;
  currentPage++;
  const btn = document.getElementById('loadMoreBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Loading...'; }
  try {
    const result = await fetchFiles(workspaceId, currentPage);
    hasMoreFiles = result.hasMore;
    appendFiles(result.data);
  } catch {
    showToast('Failed to load more files.', 'error');
    currentPage--;
    if (btn) { btn.disabled = false; btn.textContent = 'Load More'; }
  }
}

function fileExt(mime, filename) {
  if (filename) {
    const parts = filename.split('.');
    if (parts.length > 1) return parts.pop().toUpperCase().slice(0, 6);
  }
  const map = {
    'application/pdf': 'PDF',
    'image/jpeg': 'JPG', 'image/png': 'PNG', 'image/gif': 'GIF',
    'image/webp': 'WEBP', 'image/svg+xml': 'SVG',
    'video/mp4': 'MP4', 'video/webm': 'WEBM', 'video/quicktime': 'MOV',
    'audio/mpeg': 'MP3', 'audio/wav': 'WAV', 'audio/ogg': 'OGG',
    'text/plain': 'TXT', 'text/csv': 'CSV', 'application/json': 'JSON',
    'application/msword': 'DOC',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
    'application/vnd.ms-excel': 'XLS',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
    'application/vnd.ms-powerpoint': 'PPT',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
  };
  return map[mime] || 'FILE';
}

function renderFiles(files) {
  const container = document.getElementById('filesList');
  selectedFiles.clear();
  updateBulkBar();

  if (!files.length) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <div class="empty-state-title">No files yet</div>
        <div class="empty-state-desc">Upload files or drag them anywhere on the page.</div>
      </div>`;
    return;
  }

  container.innerHTML = `<div class="wf-grid">${files.map(f => fileCard(f)).join('')}</div>`;
  updateLoadMoreBtn();
  loadImageThumbnails();
}

function appendFiles(files) {
  const container = document.getElementById('filesList');
  const grid = container.querySelector('.wf-grid');
  if (!grid) { renderFiles(files); return; }
  grid.insertAdjacentHTML('beforeend', files.map(f => fileCard(f)).join(''));
  updateLoadMoreBtn();
  loadImageThumbnails();
}

function updateLoadMoreBtn() {
  const existing = document.getElementById('loadMoreWrap');
  if (existing) existing.remove();
  if (!hasMoreFiles) return;
  const container = document.getElementById('filesList');
  const wrap = document.createElement('div');
  wrap.id = 'loadMoreWrap';
  wrap.style.cssText = 'text-align:center;margin-top:20px;padding-bottom:8px;';
  wrap.innerHTML = '<button id="loadMoreBtn" class="btn-app-ghost" onclick="loadMoreFiles()">Load More</button>';
  container.appendChild(wrap);
}

function fileCard(f) {
  const name     = f.filename || f.original_name || 'File';
  const ext      = fileExt(f.mime_type || '', name);
  const icon     = fileTypeSvg(f.mime_type || '');
  const size     = formatBytes(f.size || 0);
  const date     = formatDate(f.created_at || f.uploaded_at);
  const id       = f.file_id;
  const safeName = escapeHtml(name);
  const isImage  = (f.mime_type || '').startsWith('image/');
  const iconHtml = isImage
    ? `<div class="wf-card-thumb-wrap" id="thumb-${id}">${icon}</div>`
    : `<div class="wf-card-icon">${icon}</div>`;

  return `
    <div class="wf-card" id="card-${id}" onclick="openFile(event,${id})">
      <div class="wf-card-check-wrap">
        <input type="checkbox" class="wf-card-check file-check" data-id="${id}" onchange="toggleSelect(${id}, this.checked)" />
      </div>
      <span class="wf-card-badge">${escapeHtml(ext)}</span>
      ${iconHtml}
      <div class="wf-card-name" title="${safeName}">${safeName}</div>
      <div class="wf-card-meta">
        <span>${escapeHtml(size)}</span>
        <span>${escapeHtml(date)}</span>
      </div>
      <div class="wf-card-actions">
        <button class="wf-action-btn" title="Download" onclick="downloadFile(${id}, '${safeName}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>
        <button class="wf-action-btn" title="Share link" onclick="openShareFile(${id}, '${safeName}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        </button>
        <button class="wf-action-btn" title="Rename" onclick="openRenameFile(${id}, '${safeName}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="wf-action-btn danger" title="Delete" onclick="confirmDeleteFile(${id}, '${safeName}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div>
    </div>`;
}

async function loadImageThumbnails() {
  const wraps = document.querySelectorAll('[id^="thumb-"]');
  await Promise.allSettled([...wraps].map(async wrap => {
    const id = wrap.id.replace('thumb-', '');
    try {
      const result = await fetchFileDownloadUrl(id);
      const url = result?.url || result;
      if (!url || !wrap.isConnected) return;
      const img = new Image();
      img.className = 'wf-card-thumb';
      img.alt = '';
      img.onload = () => {
        if (wrap.isConnected) {
          wrap.innerHTML = '';
          wrap.appendChild(img);
        }
      };
      img.src = url;
    } catch {}
  }));
}

function toggleSelectAll(checked) {
  document.querySelectorAll('.file-check').forEach(cb => {
    cb.checked = checked;
    const id = Number(cb.dataset.id);
    checked ? selectedFiles.add(id) : selectedFiles.delete(id);
    document.getElementById('card-' + id)?.classList.toggle('selected', checked);
  });
  updateBulkBar();
}

function toggleSelect(id, checked) {
  checked ? selectedFiles.add(id) : selectedFiles.delete(id);
  document.getElementById('card-' + id)?.classList.toggle('selected', checked);
  updateBulkBar();
}

function updateBulkBar() {
  const btn = document.getElementById('bulkDeleteBtn');
  if (!btn) return;
  if (selectedFiles.size > 0) {
    btn.disabled = false;
    btn.querySelector('span').textContent = `Delete (${selectedFiles.size})`;
  } else {
    btn.disabled = true;
    btn.querySelector('span').textContent = 'Delete';
  }
}

function openFile(e, id) {
  if (e.target.closest('.wf-card-check-wrap') || e.target.closest('.wf-card-actions')) return;
  previewFile(id);
}

async function previewFile(id) {
  try {
    const data = await fetchFileDownloadUrl(id);
    const url  = data.url || data.download_url;
    if (!url) return;
    window.open(url, '_blank', 'noopener');
  } catch {
    showToast('Could not open file.', 'error');
  }
}

async function downloadFile(id, filename) {
  try {
    const data = await fetchFileDirectDownloadUrl(id);
    const url  = data.url;
    if (!url) { showToast('No download URL.', 'error'); return; }
    const a = document.createElement('a');
    a.href = url;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch {
    showToast('Could not download file.', 'error');
  }
}

function openShareFile(id, filename) {
  openModal(`
    <div class="modal" style="max-width:380px;">
      <button class="modal-close" onclick="closeModal()" style="position:absolute;top:14px;right:14px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      <div class="modal-body" style="display:block;padding-top:8px;">
        <p style="font-size:0.82rem;font-weight:600;color:var(--text);text-align:center;margin:0 0 14px;">Link expires in</p>
        <div class="share-expiry-btns" style="justify-content:center;" id="shareExpiryBtns">
          <button class="share-expiry-btn active" data-s="3600">1 hour</button>
          <button class="share-expiry-btn" data-s="21600">6 hours</button>
          <button class="share-expiry-btn" data-s="86400">24 hours</button>
          <button class="share-expiry-btn" data-s="604800">7 days</button>
        </div>
        <div id="shareResult" style="display:none;margin-top:16px;">
          <div class="share-url-row" style="margin-bottom:5px;">
            <input type="text" id="shareUrlInput" class="form-input" readonly style="font-size:0.78rem;" />
            <button class="btn-app-ghost" id="shareCopyBtn" onclick="copyShareUrl()">Copy</button>
          </div>
          <p id="shareExpiryNote" style="font-size:0.72rem;color:var(--text-muted);margin:0;"></p>
        </div>
        <div class="form-status" id="shareStatus" style="margin-top:8px;"></div>
      </div>
      <div class="modal-footer" style="justify-content:center;margin-top:18px;">
        <button class="btn-app-ghost" onclick="closeModal()">Close</button>
        <button class="btn-app-primary" id="shareGenBtn" onclick="generateShareLink(${id})">Generate Link</button>
      </div>
    </div>`);

  document.getElementById('shareExpiryBtns')?.querySelectorAll('.share-expiry-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.share-expiry-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const res = document.getElementById('shareResult');
      if (res) res.style.display = 'none';
    });
  });
}

async function generateShareLink(id) {
  const btn    = document.getElementById('shareGenBtn');
  const status = document.getElementById('shareStatus');
  const active = document.querySelector('.share-expiry-btn.active');
  const expiry = Number(active?.dataset.s || 3600);

  btn.disabled = true; btn.textContent = 'Generating...';
  showStatus(status, '', '');
  try {
    const data = await fetchFileShareUrl(id, expiry);
    document.getElementById('shareUrlInput').value = data.url;
    document.getElementById('shareResult').style.display = 'block';
    const exp = new Date(data.expires_at);
    document.getElementById('shareExpiryNote').textContent = `Expires ${exp.toLocaleString()}`;
    btn.textContent = 'Regenerate';
  } catch (err) {
    showStatus(status, err.message || 'Failed to generate link.', 'error');
    btn.textContent = 'Generate Link';
  }
  btn.disabled = false;
}

function copyShareUrl() {
  const val = document.getElementById('shareUrlInput')?.value;
  if (!val) return;
  navigator.clipboard.writeText(val).then(() => {
    const btn = document.getElementById('shareCopyBtn');
    if (btn) { btn.textContent = 'Copied!'; setTimeout(() => btn.textContent = 'Copy', 2000); }
  }).catch(() => {
    document.getElementById('shareUrlInput')?.select();
    document.execCommand('copy');
  });
}

function openRenameFile(id, currentName) {
  openModal(`
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">Rename File</div>
        <button class="modal-close" onclick="closeModal()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">File name</label>
          <input type="text" id="fileRenameInput" class="form-input" value="${escapeHtml(currentName)}" />
        </div>
        <div class="form-status" id="fileRenameStatus"></div>
      </div>
      <div class="modal-footer">
        <button class="btn-app-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn-app-primary" id="fileRenameBtn" onclick="handleRenameFile(${id})">Save</button>
      </div>
    </div>`);
  setTimeout(() => document.getElementById('fileRenameInput')?.focus(), 60);
}

async function handleRenameFile(id) {
  const name   = document.getElementById('fileRenameInput')?.value.trim();
  const btn    = document.getElementById('fileRenameBtn');
  const status = document.getElementById('fileRenameStatus');
  if (!name) { showStatus(status, 'Name cannot be empty.', 'error'); return; }
  btn.disabled = true; btn.textContent = 'Saving...';
  try {
    await renameFile(id, name);
    closeModal(); showToast('Renamed.', 'success'); await loadFiles();
  } catch (err) {
    showStatus(status, err.message || 'Failed to rename.', 'error');
    btn.disabled = false; btn.textContent = 'Save';
  }
}

function confirmDeleteFile(id, name) {
  openModal(`
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">Delete File</div>
        <button class="modal-close" onclick="closeModal()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>
      <div class="modal-body">
        <p style="font-size:0.9rem;color:var(--text-sub);">Delete <strong>${escapeHtml(name)}</strong>? This cannot be undone.</p>
      </div>
      <div class="modal-footer">
        <button class="btn-app-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn-danger" id="fileDelBtn" onclick="handleDeleteFiles([${id}])">Delete</button>
      </div>
    </div>`);
}

function openBulkDelete() {
  const count = selectedFiles.size;
  openModal(`
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">Delete Files</div>
        <button class="modal-close" onclick="closeModal()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>
      <div class="modal-body">
        <p style="font-size:0.9rem;color:var(--text-sub);">Delete <strong>${count} file${count > 1 ? 's' : ''}</strong>? This cannot be undone.</p>
      </div>
      <div class="modal-footer">
        <button class="btn-app-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn-danger" id="bulkDelBtn" onclick="handleDeleteFiles([...selectedFiles])">Delete</button>
      </div>
    </div>`);
}

async function handleDeleteFiles(ids) {
  const btn = document.getElementById('bulkDelBtn') || document.getElementById('fileDelBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Deleting...'; }
  try {
    await deleteFiles(ids.map(Number));
    closeModal(); showToast(`${ids.length} file${ids.length > 1 ? 's' : ''} deleted.`, 'success');
    await loadFiles();
  } catch (err) {
    showToast(err.message || 'Failed to delete.', 'error');
    closeModal();
  }
}

async function uploadFiles(files) {
  const progress     = document.getElementById('uploadProgress');
  const progressFill = document.getElementById('uploadProgressFill');
  const progressText = document.getElementById('uploadProgressText');

  progress.style.display = 'flex';
  progressFill.style.width = '0%';
  progressText.textContent = 'Uploading...';

  try {
    const uploaded = await uploadFilesXhr(workspaceId, files, pct => {
      progressFill.style.width = pct + '%';
      progressText.textContent = `Uploading… ${pct}%`;
    });

    const newFiles = Array.isArray(uploaded) ? uploaded : (uploaded ? [uploaded] : []);
    if (newFiles.length) addNewFilesToGrid(newFiles);

    showToast(`${files.length} file${files.length > 1 ? 's' : ''} uploaded.`, 'success');
  } catch (err) {
    showToast(err.message || 'Upload failed.', 'error');
  } finally {
    progress.style.display = 'none';
    document.getElementById('fileInput').value = '';
  }
}

function addNewFilesToGrid(newFiles) {
  const container = document.getElementById('filesList');
  let grid = container.querySelector('.wf-grid');

  if (!grid) {
    container.innerHTML = '<div class="wf-grid"></div>';
    grid = container.querySelector('.wf-grid');
  }

  grid.insertAdjacentHTML('afterbegin', newFiles.map(f => fileCard(f)).join(''));
}
