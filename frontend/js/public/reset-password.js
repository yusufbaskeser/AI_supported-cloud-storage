document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initAuthParticles();
  initSmoothLinks();
  initPasswordToggles();

  const params = new URLSearchParams(window.location.search);
  const token  = params.get('token');

  if (!token) {
    document.getElementById('resetForm').style.display    = 'none';
    document.getElementById('invalidToken').style.display = 'block';
    return;
  }

  document.getElementById('resetBtn').addEventListener('click', async () => {
    const newPassword     = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const btn             = document.getElementById('resetBtn');
    const status          = document.getElementById('resetStatus');

    clearStatus(status);
    if (newPassword.length < 8) { showStatus(status, 'Password must be at least 8 characters.', 'error'); return; }
    if (newPassword !== confirmPassword) { showStatus(status, 'Passwords do not match.', 'error'); return; }

    setLoading(btn, true, 'Updating...');

    try {
      await resetPassword(token, newPassword);
      showStatus(status, 'Password updated! Redirecting...', 'success');
      setTimeout(() => navigate('login'), 1800);
    } catch (err) {
      showStatus(status, err.message, 'error');
      setLoading(btn, false, 'Update Password');
    }
  });
});
