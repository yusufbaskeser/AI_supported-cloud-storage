let currentUserId = null;

document.addEventListener('DOMContentLoaded', async () => {
  initApp();
  showPageLoader();
  const user = getAppUser();
  currentUserId = user?.user_id;
  if (!currentUserId) { hidePageLoader(); return; }
  await loadProfile();
  initPhotoUpload();
  hidePageLoader();
});

async function loadProfile() {
  try {
    const data = await fetchUser(currentUserId);
    const name    = data.name || '';
    const initial = name ? name[0].toUpperCase() : (data.email?.[0] || '?').toUpperCase();

    document.getElementById('nameInput').value = name;

    const avatarInitial = document.getElementById('peAvatarInitial');
    const avatarImg     = document.getElementById('peAvatarImg');
    if (avatarInitial) avatarInitial.textContent = initial;

    if (data.profile_photo) {
      updateNavAvatar(data.profile_photo);
      if (avatarImg)     { avatarImg.src = data.profile_photo; avatarImg.style.display = 'block'; }
      if (avatarInitial) avatarInitial.style.display = 'none';
    } else {
      if (avatarImg)     avatarImg.style.display = 'none';
      if (avatarInitial) avatarInitial.style.display = 'flex';
    }
  } catch {
    showToast('Failed to load profile.', 'error');
  }
}

function initPhotoUpload() {
  const btn   = document.getElementById('pePhotoBtn');
  const input = document.getElementById('pePhotoInput');
  if (!btn || !input) return;

  btn.addEventListener('click', () => input.click());

  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('Image must be under 5 MB.', 'error'); return; }

    btn.disabled = true;
    const orig = btn.innerHTML;
    btn.innerHTML = 'Uploading…';
    try {
      const dataUrl = await resizeImageToDataUrl(file, 240, 0.85);
      await updateUser(currentUserId, { profile_photo: dataUrl });

      const avatarImg     = document.getElementById('peAvatarImg');
      const avatarInitial = document.getElementById('peAvatarInitial');
      if (avatarImg)     { avatarImg.src = dataUrl; avatarImg.style.display = 'block'; }
      if (avatarInitial) avatarInitial.style.display = 'none';
      updateNavAvatar(dataUrl);
      showToast('Profile photo updated.', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to update photo.', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = orig;
      input.value  = '';
    }
  });
}

async function saveName() {
  const name   = document.getElementById('nameInput').value.trim();
  const btn    = document.getElementById('saveNameBtn');
  const status = document.getElementById('nameStatus');
  if (!name) { showStatus(status, 'Name cannot be empty.', 'error'); return; }
  btn.disabled = true;
  try {
    await updateUser(currentUserId, { name });
    localStorage.setItem('sc-display-name', name);
    const initEl = document.getElementById('navAvatarInitial');
    if (initEl) initEl.textContent = name.charAt(0).toUpperCase();
    showStatus(status, 'Name updated successfully.', 'success');
    showToast('Name updated.', 'success');
  } catch (err) {
    showStatus(status, err.message || 'Failed to save.', 'error');
  } finally {
    btn.disabled = false;
  }
}

async function savePassword() {
  const pass    = document.getElementById('newPasswordInput').value;
  const confirm = document.getElementById('confirmPasswordInput').value;
  const btn     = document.getElementById('savePasswordBtn');
  const status  = document.getElementById('passwordStatus');
  if (pass.length < 8) { showStatus(status, 'Password must be at least 8 characters.', 'error'); return; }
  if (pass !== confirm) { showStatus(status, 'Passwords do not match.', 'error'); return; }
  btn.disabled = true; btn.textContent = 'Updating…';
  try {
    await updateUser(currentUserId, { password: pass });
    document.getElementById('newPasswordInput').value    = '';
    document.getElementById('confirmPasswordInput').value = '';
    showStatus(status, 'Password updated successfully.', 'success');
    showToast('Password updated.', 'success');
  } catch (err) {
    showStatus(status, err.message || 'Failed to update password.', 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Update Password';
  }
}

