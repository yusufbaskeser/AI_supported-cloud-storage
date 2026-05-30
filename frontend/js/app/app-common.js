function getToken() { return localStorage.getItem('sc-token'); }

function parseJwt(token) {
  try { return JSON.parse(atob(token.split('.')[1])); }
  catch { return null; }
}

function getAppUser() {
  const t = getToken(); return t ? parseJwt(t) : null;
}

function requireAuth() {
  if (!getToken()) { window.location.replace('/login'); return false; }
  return true;
}

function logout() {
  localStorage.removeItem('sc-token');
  localStorage.removeItem('sc-profile-photo');
  localStorage.removeItem('sc-display-name');
  window.location.replace('/login');
}

function authHeaders(isJson = true) {
  const h = { 'Authorization': `Bearer ${getToken()}` };
  if (isJson) h['Content-Type'] = 'application/json';
  return h;
}

async function apiCall(method, path, body) {
  const opts = { method, headers: authHeaders() };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${path}`, opts);
  if (res.status === 401) { logout(); return null; }
  return res;
}

async function extractError(res) {
  try { const d = await res.json(); return d?.message || 'Something went wrong.'; }
  catch { return 'Something went wrong.'; }
}

function injectAppLayout(includeFooter = true) {
  const nb = document.getElementById('navbar-placeholder');
  if (nb) nb.outerHTML = `
<nav class="navbar" id="navbar">
  <div class="nav-container">
    <a href="dashboard" class="nav-logo">
      <img src="assets/logo.png" alt="SynapseCloud" class="logo-img" />
      <span class="logo-text">Synapse<span class="logo-accent">Cloud</span></span>
    </a>
    <ul class="nav-links" id="navLinks">
      <li><a href="dashboard" class="nav-link">Dashboard</a></li>
      <li><a href="workspaces" class="nav-link">Workspaces</a></li>
      <li><a href="chat" class="nav-link">AI Chat</a></li>
    </ul>
    <div class="nav-actions">
      <button class="theme-toggle" id="themeToggle">
        <img src="assets/icons/sun.svg" alt="Toggle theme" id="themeIcon" />
      </button>
      <a href="profile" class="nav-avatar" id="navAvatar" title="Profile">
        <img id="navAvatarImg" alt="" style="display:none;" />
        <span id="navAvatarInitial">?</span>
      </a>
      <button class="hamburger" id="hamburger">
        <img src="assets/icons/hamburger_menu.svg" alt="Menu" />
      </button>
    </div>
  </div>
</nav>`;

  if (!includeFooter) return;
  const ft = document.getElementById('footer-placeholder');
  if (!ft) return;
  ft.outerHTML = `
<footer class="footer">
  <div class="footer-container">
    <div class="footer-top">
      <div class="footer-brand">
        <a href="dashboard" class="nav-logo" style="margin-bottom:12px;">
          <img src="assets/logo.png" alt="SynapseCloud" class="logo-img" />
          <span class="logo-text">Synapse<span class="logo-accent">Cloud</span></span>
        </a>
        <p class="footer-desc">AI-powered cloud storage that helps you focus on what matters.</p>
        <div class="footer-socials">
          <a href="#" class="social-link"><img src="assets/icons/github.svg" alt="GitHub" /></a>
          <a href="#" class="social-link"><img src="assets/icons/instagram.svg" alt="Instagram" /></a>
          <a href="#" class="social-link"><img src="assets/icons/link.svg" alt="LinkedIn" /></a>
        </div>
      </div>
      <div class="footer-links-grid">
        <div class="footer-col">
          <h4 class="footer-col-title">Navigate</h4>
          <a href="dashboard" class="footer-link">Dashboard</a>
          <a href="workspaces" class="footer-link">Workspaces</a>
          <a href="chat" class="footer-link">AI Chat</a>
        </div>
        <div class="footer-col">
          <h4 class="footer-col-title">Account</h4>
          <a href="profile" class="footer-link">Profile</a>
          <a href="#" class="footer-link" onclick="logout();return false;">Sign Out</a>
        </div>
        <div class="footer-col">
          <h4 class="footer-col-title">Support</h4>
          <a href="contact" class="footer-link">Contact Us</a>
          <a href="#" class="footer-link">Help Center</a>
        </div>
      </div>
    </div>
    <div class="footer-bottom">
      <p class="footer-copy">© 2026 Synapse Cloud. All rights reserved.</p>
      <div class="footer-legal">
        <a href="#" class="footer-legal-link">Privacy</a>
        <a href="#" class="footer-legal-link">Terms</a>
      </div>
    </div>
  </div>
</footer>`;
}

function navigate(url) {
  document.body.classList.add('page-exit');
  setTimeout(() => { window.location.href = url; }, 230);
}

function initTheme() {
  const html  = document.documentElement;
  const saved = localStorage.getItem('sc-theme') || 'light';
  html.setAttribute('data-theme', saved);
  syncThemeIcon(saved);

  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    html.classList.add('theme-switching');
    const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('sc-theme', next);
    syncThemeIcon(next);
    setTimeout(() => html.classList.remove('theme-switching'), 320);
  });
}

function syncThemeIcon(theme) {
  const icon = document.getElementById('themeIcon');
  if (icon) icon.src = theme === 'dark' ? 'assets/icons/moon.svg' : 'assets/icons/sun.svg';
}

function initNavbar() {
  const hamburger = document.getElementById('hamburger');
  const navLinks  = document.getElementById('navLinks');
  if (!hamburger || !navLinks) return;

  hamburger.addEventListener('click', (e) => {
    e.stopPropagation();
    navLinks.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (!navLinks.contains(e.target) && e.target !== hamburger) {
      navLinks.classList.remove('open');
    }
  });
}

function setActiveNavLink() {
  const page = window.location.pathname.split('/').pop().split('?')[0];
  document.querySelectorAll('.nav-link').forEach(el => {
    const href = (el.getAttribute('href') || '').split('?')[0];
    el.classList.toggle('active', href === page || href.endsWith('/' + page));
  });
}

function initNavAvatar() {
  const user    = getAppUser();
  const avatarEl = document.getElementById('navAvatar');
  const imgEl   = document.getElementById('navAvatarImg');
  const initEl  = document.getElementById('navAvatarInitial');
  if (!avatarEl) return;

  const initial = (localStorage.getItem('sc-display-name') || user?.username || user?.email || '?').charAt(0).toUpperCase();
  if (initEl) initEl.textContent = initial;

  const cached = localStorage.getItem('sc-profile-photo');
  if (cached && imgEl) {
    imgEl.src = cached;
    imgEl.style.display = 'block';
    if (initEl) initEl.style.display = 'none';
  }
}

function updateNavDisplayName(name) {
  if (!name) return;
  localStorage.setItem('sc-display-name', name);
  const initEl = document.getElementById('navAvatarInitial');
  if (initEl && initEl.style.display !== 'none') {
    initEl.textContent = name.charAt(0).toUpperCase();
  }
}

function updateNavAvatar(photoDataUrl) {
  const imgEl  = document.getElementById('navAvatarImg');
  const initEl = document.getElementById('navAvatarInitial');
  if (photoDataUrl) {
    localStorage.setItem('sc-profile-photo', photoDataUrl);
    if (imgEl)  { imgEl.src = photoDataUrl; imgEl.style.display = 'block'; }
    if (initEl) initEl.style.display = 'none';
  } else {
    localStorage.removeItem('sc-profile-photo');
    if (imgEl)  imgEl.style.display = 'none';
    if (initEl) initEl.style.display = 'flex';
  }
}

function showToast(msg, type = '') {
  let c = document.getElementById('toastContainer');
  if (!c) {
    c = document.createElement('div');
    c.id = 'toastContainer';
    c.className = 'toast-container';
    document.body.appendChild(c);
  }
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

function openModal(html) {
  const bd = document.createElement('div');
  bd.className = 'modal-backdrop';
  bd.id = 'activeModal';
  bd.innerHTML = html;
  document.body.appendChild(bd);
  bd.addEventListener('click', e => { if (e.target === bd) closeModal(); });
  return bd;
}

function closeModal() {
  document.getElementById('activeModal')?.remove();
}

function showStatus(el, msg, type) {
  if (!el) return;
  el.textContent = msg;
  el.className = `form-status ${type}`;
}

function initApp(includeFooter = true) {
  if (!requireAuth()) return;
  injectAppLayout(includeFooter);
  initTheme();
  initNavbar();
  setActiveNavLink();
  initNavAvatar();
}

function showPageLoader() {
  if (document.getElementById('sc-loader')) return;
  const el = document.createElement('div');
  el.id = 'sc-loader';
  el.className = 'sc-loader';
  el.innerHTML = `<svg class="sc-loader-ring" viewBox="0 0 50 50"><circle cx="25" cy="25" r="20" fill="none" stroke-width="3.5"/></svg>`;
  document.body.appendChild(el);
}

function hidePageLoader() {
  const el = document.getElementById('sc-loader');
  if (!el) return;
  el.classList.add('sc-loader--out');
  setTimeout(() => el.remove(), 300);
}
