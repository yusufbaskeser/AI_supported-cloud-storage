document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initAuthParticles();
  initSmoothLinks();
  initPasswordToggles();

  if (localStorage.getItem('sc-token')) {
    window.location.replace('/dashboard');
    return;
  }

  let registeredEmail  = '';
  let profilePhotoData = null;

  const avatarInput   = document.getElementById('avatarInput');
  const avatarPreview = document.getElementById('avatarPreview');

  avatarInput?.addEventListener('change', async () => {
    const file = avatarInput.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5 MB.'); return; }
    profilePhotoData = await resizeImageToDataUrl(file, 240, 0.85);
    avatarPreview.innerHTML = `<img src="${profilePhotoData}" alt="Avatar" />`;
  });

  document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username        = document.getElementById('username').value.trim();
    const email           = document.getElementById('email').value.trim();
    const password        = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const btn             = document.getElementById('registerBtn');
    const status          = document.getElementById('formStatus');

    clearStatus(status);

    if (password !== confirmPassword) { showStatus(status, 'Passwords do not match.', 'error'); return; }
    if (password.length < 8) { showStatus(status, 'Password must be at least 8 characters.', 'error'); return; }

    setLoading(btn, true, 'Creating account...');

    try {
      await register(username, email, password, profilePhotoData || undefined);
      registeredEmail = email;
      goToOtp(email);
    } catch (err) {
      showStatus(status, err.message, 'error');
      setLoading(btn, false, 'Create Account');
    }
  });

  document.getElementById('verifyBtn').addEventListener('click', async () => {
    const code   = document.getElementById('otpCode').value.trim();
    const btn    = document.getElementById('verifyBtn');
    const status = document.getElementById('otpStatus');

    clearStatus(status);
    if (!code || code.length !== 6) { showStatus(status, 'Enter the 6-digit code from your email.', 'error'); return; }

    setLoading(btn, true, 'Verifying...');

    try {
      await verifyEmail(registeredEmail, code);
      showStatus(status, 'Email verified! Redirecting...', 'success');
      setTimeout(() => navigate('login'), 1500);
    } catch (err) {
      showStatus(status, err.message, 'error');
      setLoading(btn, false, 'Verify Email');
    }
  });

  document.getElementById('otpCode').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '');
  });

  function goToOtp(email) {
    document.getElementById('stepRegister').style.display = 'none';
    document.getElementById('stepVerify').style.display   = 'block';
    document.querySelector('.auth-title').textContent    = 'Check your email';
    document.querySelector('.auth-subtitle').textContent = `Code sent to ${email}`;
    document.getElementById('otpDesc').textContent = `We sent a 6-digit verification code to ${email}.`;
    document.getElementById('otpCode').focus();
  }
});
