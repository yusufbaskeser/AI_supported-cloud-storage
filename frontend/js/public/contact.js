document.getElementById('contactForm').addEventListener('submit', function(e) {
  e.preventDefault();

  const firstName = document.getElementById('firstName').value.trim();
  const lastName  = document.getElementById('lastName').value.trim();
  const email     = document.getElementById('email').value.trim();
  const subject   = document.getElementById('subject').value.trim();
  const message   = document.getElementById('message').value.trim();
  const status    = document.getElementById('formStatus');
  const btn       = this.querySelector('.btn-submit');

  if (!firstName || !lastName || !email || !subject || !message) {
    status.className = 'form-status error';
    status.textContent = 'Please fill in all fields.';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Sending...';
  status.className = 'form-status';
  status.textContent = '';

  const body   = `Name: ${firstName} ${lastName}\nEmail: ${email}\n\n${message}`;
  const mailto = `mailto:yusufbaskeser2005@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  setTimeout(() => {
    window.location.href = mailto;
    status.className = 'form-status success';
    status.textContent = 'Your mail client has been opened. Thank you for reaching out!';
    btn.textContent = 'Send Message';

    setTimeout(() => {
      this.reset();
      status.className = 'form-status';
      status.textContent = '';
      btn.disabled = false;
    }, 5000);
  }, 600);
});
