function navigate(url) {
  document.body.classList.add('page-exit');
  setTimeout(() => { window.location.href = url; }, 230);
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('navbar-placeholder').innerHTML = `
    <nav class="navbar" id="navbar">
      <div class="nav-container">
        <a href="index" class="nav-logo">
          <img src="assets/logo.png" alt="SynapseCloud" class="logo-img" />
          <span class="logo-text">Synapse<span class="logo-accent">Cloud</span></span>
        </a>
        <ul class="nav-links" id="navLinks">
          <li><a href="index" class="nav-link">Home</a></li>
          <li><a href="features" class="nav-link">Features</a></li>
          <li><a href="about" class="nav-link">About Us</a></li>
          <li><a href="contact" class="nav-link">Contact</a></li>
          <li class="nav-mobile-auth"><a href="login" class="nav-link">Login</a></li>
          <li class="nav-mobile-auth"><a href="register" class="nav-link nav-link--accent">Register</a></li>
        </ul>
        <div class="nav-actions">
          <button class="theme-toggle" id="themeToggle">
            <img src="assets/icons/sun.svg" alt="Toggle theme" id="themeIcon" />
          </button>
          <a href="login" class="btn-ghost">Login</a>
          <a href="register" class="btn-primary">Register</a>
          <button class="hamburger" id="hamburger">
            <img src="assets/icons/hamburger_menu.svg" alt="Menu" />
          </button>
        </div>
      </div>
    </nav>
  `;

  document.getElementById('footer-placeholder').innerHTML = `
    <footer class="footer">
      <div class="footer-container">
        <div class="footer-top">
          <div class="footer-brand">
            <a href="index" class="nav-logo">
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
              <h4 class="footer-col-title">Product</h4>
              <a href="features" class="footer-link">Features</a>
              <a href="register" class="footer-link">Get Started</a>
            </div>
            <div class="footer-col">
              <h4 class="footer-col-title">Company</h4>
              <a href="about" class="footer-link">About Us</a>
              <a href="contact" class="footer-link">Contact</a>
            </div>
            <div class="footer-col">
              <h4 class="footer-col-title">Account</h4>
              <a href="login" class="footer-link">Sign In</a>
              <a href="register" class="footer-link">Create Account</a>
            </div>
          </div>
        </div>
        <div class="footer-bottom">
          <p class="footer-copy">Â© 2026 Synapse Cloud. All rights reserved.</p>
          <div class="footer-legal">
            <a href="#" class="footer-legal-link">Privacy</a>
            <a href="#" class="footer-legal-link">Terms</a>
          </div>
        </div>
      </div>
    </footer>
  `;

  const html  = document.documentElement;
  const saved = localStorage.getItem('sc-theme') || 'light';
  html.setAttribute('data-theme', saved);
  updateIcon(saved);

  setActiveNavLink();

  document.getElementById('themeToggle').addEventListener('click', async () => {
    html.classList.add('theme-switching');
    const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('sc-theme', next);
    updateIcon(next);
    if (typeof SynapseParticles !== 'undefined') {
      await SynapseParticles.onThemeChange(next);
    }
    setTimeout(() => html.classList.remove('theme-switching'), 320);
  });

  document.getElementById('hamburger').addEventListener('click', () => {
    document.getElementById('navLinks').classList.toggle('open');
  });

  document.querySelectorAll('a[href]').forEach(el => {
    const href = el.getAttribute('href');
    if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto')) return;
    el.addEventListener('click', e => {
      e.preventDefault();
      navigate(href);
    });
  });

  if (typeof SynapseParticles !== 'undefined' && document.getElementById('hero-particles')) {
    SynapseParticles.initHero('hero-particles');
  }

  const scrollBtn = document.createElement('button');
  scrollBtn.className = 'scroll-top';
  scrollBtn.setAttribute('aria-label', 'Back to top');
  scrollBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>`;
  document.body.appendChild(scrollBtn);

  window.addEventListener('scroll', () => {
    scrollBtn.classList.toggle('visible', window.scrollY > 320);
  });
  scrollBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  function updateIcon(theme) {
    const icon = document.getElementById('themeIcon');
    if (!icon) return;
    icon.src = theme === 'dark'
      ? 'assets/icons/moon.svg'
      : 'assets/icons/sun.svg';
  }

  function setActiveNavLink() {
    const page = window.location.pathname.split('/').pop().split('?')[0];
    document.querySelectorAll('.nav-link').forEach(link => {
      if (link.getAttribute('href') === page) {
        link.classList.add('active');
      }
    });
  }
});
