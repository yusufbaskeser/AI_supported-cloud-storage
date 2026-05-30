let currentUserId = null;

const FUN_FACTS = [
  "The first website ever published is still online. Tim Berners-Lee launched info.cern.ch in 1991 — it simply explains what the World Wide Web is.",
  "Twenty years ago, most offices relied on fax machines to share documents. Sending a contract meant standing next to a printer listening to dial-up tones for minutes.",
  "The smartphone in your pocket has more computing power than all of NASA combined when it landed humans on the Moon in 1969.",
  "In 1995, only 0.4% of the world had internet access. Today it's over 66% — roughly 5.4 billion people connected.",
  "The first email ever sent was by Ray Tomlinson in 1971. He later admitted he couldn't remember what it said.",
  "A mainframe computer in the 1950s cost millions of dollars, filled an entire room, and had less processing power than a basic calculator you'd find in a $1 store today.",
  "The world sends around 333 billion emails every single day — more messages in 24 hours than the total number of letters sent across the entire 19th century.",
  "Before cloud storage, 'backing up your files' meant burning a CD and hoping you labeled it correctly. Lose the CD, lose everything.",
  "The floppy disk save icon 💾 is used by billions of people who have never held an actual floppy disk. It's arguably the most successful symbol to outlive the thing it represents.",
  "In 2000, a 1 GB USB flash drive cost around $350. Today you can buy 1 TB — a thousand times more storage — for under $20.",
];

document.addEventListener('DOMContentLoaded', async () => {
  initApp();
  showPageLoader();
  SynapseParticles.initHero('profile-particles');
  SynapseParticles.initHero('profile-fact-particles');

  const randomFact = FUN_FACTS[Math.floor(Math.random() * FUN_FACTS.length)];
  document.getElementById('profileFunFactText').textContent = randomFact;

  const user = getAppUser();
  currentUserId = user?.user_id;
  if (!currentUserId) { hidePageLoader(); return; }

  const [userData, workspaces] = await Promise.all([
    fetchUser(currentUserId).catch(() => null),
    fetchWorkspaces().catch(() => []),
  ]);

  if (!userData) { hidePageLoader(); return; }

  let totalFiles = 0;
  try {
    const fileLists = await Promise.all(workspaces.map(ws => fetchFiles(ws.workspace_id).then(r => r.data ?? []).catch(() => [])));
    totalFiles = fileLists.reduce((sum, list) => sum + list.length, 0);
  } catch {}

  renderProfile(userData, workspaces, totalFiles);
  hidePageLoader();
});

function renderProfile(data, workspaces, totalFiles) {
  const name  = data.name  || '—';
  const email = data.email || '—';
  const since = data.created_at ? formatDate(data.created_at) : '—';
  const used  = Number(data.usedStorage  || 0);
  const total = Number(data.storageLimit || 5368709120);

  document.getElementById('profileHeroName').textContent    = name;
  document.getElementById('profileHeroEmail').textContent   = email;
  document.getElementById('profileMemberSince').textContent = since;
  document.getElementById('profileStorageText').textContent = `${formatBytes(used)} used`;

  const avatarInitial = document.getElementById('profileAvatarInitial');
  const avatarImg     = document.getElementById('profileAvatarImg');
  const initial       = name !== '—' ? name[0].toUpperCase() : (email[0] || '?').toUpperCase();
  if (avatarInitial) avatarInitial.textContent = initial;

  if (data.profile_photo) {
    updateNavAvatar(data.profile_photo);
    if (avatarImg)     { avatarImg.src = data.profile_photo; avatarImg.style.display = 'block'; }
    if (avatarInitial) avatarInitial.style.display = 'none';
  } else {
    if (avatarImg)     avatarImg.style.display = 'none';
    if (avatarInitial) avatarInitial.style.display = 'flex';
  }

  renderStatChips(data, workspaces, totalFiles);
}

function renderStatChips(data, workspaces, totalFiles) {
  const used    = Number(data.usedStorage  || 0);
  const total   = Number(data.storageLimit || 5368709120);
  const sinceMs = data.created_at ? Date.now() - new Date(data.created_at).getTime() : 0;
  const days    = Math.floor(sinceMs / 86400000);
  const free    = total - used;
  const wsCount = workspaces.length;

  const chips = [
    {
      color: 'blue',
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
      value: wsCount,
      label: 'Workspaces',
      desc: wsCount === 0
        ? 'No workspaces yet — create your first!'
        : wsCount === 1
          ? '1 active workspace'
          : `${wsCount} active workspaces`,
    },
    {
      color: 'green',
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>',
      value: totalFiles,
      label: 'Files Uploaded',
      desc: totalFiles === 0
        ? 'No files yet — start uploading!'
        : `across ${wsCount} workspace${wsCount !== 1 ? 's' : ''}`,
    },
    {
      color: 'amber',
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
      value: days,
      label: 'Days Active',
      desc: days < 7
        ? 'Welcome to SynapseCloud!'
        : days < 30
          ? 'Getting started — nice!'
          : days < 365
            ? `${Math.floor(days / 7)} weeks on SynapseCloud`
            : `${Math.floor(days / 365)} year${Math.floor(days / 365) > 1 ? 's' : ''} on SynapseCloud`,
    },
    {
      color: 'purple',
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
      value: formatBytes(free),
      label: 'Storage Free',
      desc: `${formatBytes(used)} used of ${formatBytes(total)}`,
    },
  ];

  document.getElementById('profileStatsRow').innerHTML = chips.map(c => `
    <div class="profile-stat-chip">
      <div class="profile-stat-top">
        <div class="profile-stat-icon ${c.color}">${c.svg}</div>
        <div class="profile-stat-value">${escapeHtml(String(c.value))}</div>
      </div>
      <div class="profile-stat-label">${escapeHtml(c.label)}</div>
      <div class="profile-stat-desc">${escapeHtml(c.desc)}</div>
    </div>`).join('');
}

function confirmDeleteAccount() {
  openModal(`
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">Delete Account</div>
        <button class="modal-close" onclick="closeModal()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>
      <div class="modal-body">
        <p style="font-size:0.9rem;color:var(--text-sub);line-height:1.55;">
          This will <strong>permanently delete</strong> your account, all workspaces, and all uploaded files.<br><br>
          This action <strong>cannot be undone</strong>. Are you sure?
        </p>
      </div>
      <div class="modal-footer">
        <button class="btn-app-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn-danger" id="delAccBtn" onclick="deleteAccount()">Yes, delete my account</button>
      </div>
    </div>`);
}

async function deleteAccount() {
  const btn = document.getElementById('delAccBtn');
  btn.disabled = true; btn.textContent = 'Deleting…';
  try {
    await deleteUser(currentUserId);
    closeModal();
    logout();
  } catch (err) {
    closeModal();
    showToast(err.message || 'Failed to delete account.', 'error');
  }
}
