function initTheme() {
  const html  = document.documentElement;
  const saved = localStorage.getItem('sc-theme') || 'light';
  html.setAttribute('data-theme', saved);
  syncThemeIcon(saved);

  document.getElementById('themeToggle').addEventListener('click', async () => {
    html.classList.add('theme-switching');
    const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('sc-theme', next);
    syncThemeIcon(next);
    await SynapseParticles.onThemeChange(next);
    setTimeout(() => html.classList.remove('theme-switching'), 320);
  });
}

function syncThemeIcon(theme) {
  const icon = document.getElementById('themeIcon');
  if (icon) {
    icon.src = theme === 'dark'
      ? 'assets/icons/moon.svg'
      : 'assets/icons/sun.svg';
  }
}

function navigate(url) {
  document.body.classList.add('page-exit');
  setTimeout(() => { window.location.href = url; }, 230);
}

function initSmoothLinks() {
  document.querySelectorAll('a[href]').forEach(el => {
    const href = el.getAttribute('href');
    if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto')) return;
    el.addEventListener('click', e => {
      e.preventDefault();
      navigate(href);
    });
  });
}

async function initAuthParticles() {
  const el = document.getElementById('auth-particles');
  if (!el || typeof SynapseParticles === 'undefined') return;
  await SynapseParticles.initAuth('auth-particles');
}

function showStatus(el, msg, type) {
  el.textContent = msg;
  el.className   = `form-status ${type}`;
}

function clearStatus(el) {
  el.textContent = '';
  el.className   = 'form-status';
}

function setLoading(btn, loading, label) {
  btn.disabled    = loading;
  btn.textContent = label;
}

function initPasswordToggles() {
  document.querySelectorAll('.input-toggle').forEach(btn => {
    const input = btn.closest('.input-wrapper')?.querySelector('[data-pw-toggle]');
    if (!input) return;
    btn.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.querySelector('.icon-eye-open').style.display = show ? 'none' : '';
      btn.querySelector('.icon-eye-off').style.display  = show ? '' : 'none';
      input.focus();
    });
  });
}
