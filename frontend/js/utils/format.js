function formatBytes(bytes) {
  bytes = Number(bytes);
  if (bytes >= 1099511627776) return (bytes / 1099511627776).toFixed(1) + ' TB';
  if (bytes >= 1073741824)    return (bytes / 1073741824).toFixed(1) + ' GB';
  if (bytes >= 1048576)       return (bytes / 1048576).toFixed(1) + ' MB';
  if (bytes >= 1024)          return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function relativeTime(dateStr) {
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `${hours}h ago`;
  const days  = Math.floor(diff / 86400000);
  if (days < 30) return `${days}d ago`;
  return formatDate(dateStr);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function renderMarkdown(raw) {
  if (!raw) return '';

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function inline(s) {
    s = s.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(?<![*])\*(?![* ])(.+?)(?<![ *])\*(?![*])/g, '<em>$1</em>');
    s = s.replace(/`(.+?)`/g, '<code class="cmd-code">$1</code>');
    return s;
  }

  const lines = raw.split('\n');
  const out   = [];
  let inUl    = false;

  const closeList = () => { if (inUl) { out.push('</ul>'); inUl = false; } };

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^---+$/.test(trimmed)) { closeList(); out.push('<hr class="cmd-hr">'); continue; }

    const h3 = trimmed.match(/^###\s+(.*)/);
    const h2 = trimmed.match(/^##\s+(.*)/);
    const h1 = trimmed.match(/^#\s+(.*)/);
    if (h3) { closeList(); out.push(`<p class="cmd-h3">${inline(esc(h3[1]))}</p>`); continue; }
    if (h2) { closeList(); out.push(`<p class="cmd-h2">${inline(esc(h2[1]))}</p>`); continue; }
    if (h1) { closeList(); out.push(`<p class="cmd-h1">${inline(esc(h1[1]))}</p>`); continue; }

    const li = trimmed.match(/^[*\-]\s+(.*)/);
    if (li) {
      if (!inUl) { out.push('<ul class="cmd-list">'); inUl = true; }
      out.push(`<li>${inline(esc(li[1]))}</li>`);
      continue;
    }

    closeList();
    if (trimmed === '') continue;
    out.push(`<span class="cmd-line">${inline(esc(trimmed))}</span><br>`);
  }

  closeList();
  return out.join('');
}

function fileTypeIcon(mimeType) {
  if (!mimeType) return '📄';
  if (mimeType.startsWith('image/'))  return '🖼️';
  if (mimeType.startsWith('video/'))  return '🎬';
  if (mimeType.startsWith('audio/'))  return '🎵';
  if (mimeType.includes('pdf'))       return '📑';
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
  if (mimeType.includes('sheet') || mimeType.includes('excel'))   return '📊';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📽️';
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar')) return '🗜️';
  if (mimeType.startsWith('text/'))   return '📄';
  return '📁';
}

function fileTypeSvg(mime) {
  let color = '#64748b', label = 'FILE';
  const ns = 'http://www.w3.org/2000/svg';
  if (!mime) {}
  else if (mime.includes('pdf'))                                              { color = '#ef4444'; label = 'PDF'; }
  else if (mime.includes('word') || mime.includes('document'))                { color = '#3b82f6'; label = 'DOC'; }
  else if (mime.includes('sheet') || mime.includes('excel'))                  { color = '#22c55e'; label = 'XLS'; }
  else if (mime.includes('presentation') || mime.includes('powerpoint'))      { color = '#f59e0b'; label = 'PPT'; }
  else if (mime === 'image/svg+xml')                                          { color = '#8b5cf6'; label = 'SVG'; }
  else if (mime.startsWith('image/'))                                         { color = '#a855f7'; label = mime.split('/')[1]?.toUpperCase().slice(0,4) || 'IMG'; }
  else if (mime.includes('mp4') || mime.includes('quicktime'))                { color = '#7c3aed'; label = 'MP4'; }
  else if (mime.startsWith('video/'))                                         { color = '#7c3aed'; label = mime.split('/')[1]?.toUpperCase().slice(0,4) || 'VID'; }
  else if (mime.includes('mp3') || mime.includes('mpeg'))                     { color = '#ec4899'; label = 'MP3'; }
  else if (mime.startsWith('audio/'))                                         { color = '#ec4899'; label = mime.split('/')[1]?.toUpperCase().slice(0,4) || 'AUD'; }
  else if (mime === 'text/csv')                                               { color = '#22c55e'; label = 'CSV'; }
  else if (mime === 'application/json')                                       { color = '#14b8a6'; label = 'JSON'; }
  else if (mime.startsWith('text/'))                                          { color = '#64748b'; label = 'TXT'; }
  else if (mime.includes('zip') || mime.includes('rar') || mime.includes('tar')) { color = '#ca8a04'; label = 'ZIP'; }

  return `<svg viewBox="0 0 56 70" fill="none" xmlns="${ns}">
    <path d="M4 0 H38 L56 18 V66 A4 4 0 0 1 52 70 H4 A4 4 0 0 1 0 66 V4 A4 4 0 0 1 4 0 Z" fill="var(--bg-subtle)" stroke="var(--border)" stroke-width="1.5"/>
    <path d="M38 0 L56 18 H42 A4 4 0 0 1 38 14 Z" fill="${color}" opacity="0.2"/>
    <path d="M38 0 L38 18 L56 18" fill="none" stroke="var(--border)" stroke-width="1.5"/>
    <rect x="0" y="44" width="56" height="26" rx="0 0 4 4" fill="${color}"/>
    <rect x="0" y="44" width="56" height="26" rx="4" fill="${color}"/>
    <text x="28" y="62" text-anchor="middle" dominant-baseline="middle" font-family="system-ui,-apple-system,sans-serif" font-size="11" font-weight="800" fill="white" letter-spacing="0.5">${label}</text>
    <rect x="8" y="26" width="22" height="2.5" rx="1.25" fill="var(--text-muted)" opacity="0.35"/>
    <rect x="8" y="32" width="30" height="2.5" rx="1.25" fill="var(--text-muted)" opacity="0.25"/>
    <rect x="8" y="38" width="26" height="2.5" rx="1.25" fill="var(--text-muted)" opacity="0.2"/>
  </svg>`;
}
