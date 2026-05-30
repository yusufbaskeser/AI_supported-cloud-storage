document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initAuthParticles();
  initSmoothLinks();
  initPasswordToggles();

  if (localStorage.getItem('sc-token')) {
    window.location.replace('/dashboard');
    return;
  }

  const savedUser = localStorage.getItem('sc-remember');
  if (savedUser) {
    document.getElementById('username').value = savedUser;
    document.getElementById('rememberMe').checked = true;
  }

  const loginForm    = document.getElementById('loginForm');
  const submitBtn    = document.getElementById('submitBtn');
  const formStatus   = document.getElementById('formStatus');
  const forgotLink   = document.getElementById('forgotLink');
  const forgotPanel  = document.getElementById('forgotPanel');
  const backBtn      = document.getElementById('backToLogin');
  const forgotSubmit = document.getElementById('forgotSubmitBtn');
  const forgotStatus = document.getElementById('forgotStatus');
  const authSwitch   = document.getElementById('authSwitch');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username   = document.getElementById('username').value.trim();
    const password   = document.getElementById('password').value;
    const rememberMe = document.getElementById('rememberMe').checked;
    if (!username || !password) return;

    setLoading(submitBtn, true, 'Signing in...');
    clearStatus(formStatus);

    try {
      const data = await login(username, password);
      if (rememberMe) {
        localStorage.setItem('sc-remember', username);
      } else {
        localStorage.removeItem('sc-remember');
      }
      localStorage.setItem('sc-token', data.token);
      showStatus(formStatus, 'Signed in successfully! Redirecting...', 'success');
      setTimeout(() => navigate('/dashboard'), 1200);
    } catch (err) {
      showStatus(formStatus, err.message, 'error');
      setLoading(submitBtn, false, 'Sign In');
    }
  });

  forgotLink.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.style.display = 'none';
    forgotPanel.style.display = 'block';
    authSwitch.style.display = 'none';
    clearStatus(forgotStatus);
    document.querySelector('.auth-title').textContent    = 'Reset password';
    document.querySelector('.auth-subtitle').textContent = "We'll send a link to your email.";
  });

  backBtn.addEventListener('click', () => {
    forgotPanel.style.display = 'none';
    loginForm.style.display   = 'flex';
    authSwitch.style.display  = '';
    clearStatus(formStatus);
    document.querySelector('.auth-title').textContent    = 'Welcome back';
    document.querySelector('.auth-subtitle').textContent = 'Sign in to your account to continue.';
  });

  forgotSubmit.addEventListener('click', async () => {
    const email = document.getElementById('forgotEmail').value.trim();
    if (!email) { showStatus(forgotStatus, 'Please enter your email.', 'error'); return; }

    setLoading(forgotSubmit, true, 'Sending...');
    clearStatus(forgotStatus);

    try {
      await forgotPassword(email);
      showStatus(forgotStatus, 'Reset link sent! Check your inbox.', 'success');
      setLoading(forgotSubmit, false, 'Send Reset Link');
    } catch (err) {
      showStatus(forgotStatus, err.message, 'error');
      setLoading(forgotSubmit, false, 'Send Reset Link');
    }
  });
});
