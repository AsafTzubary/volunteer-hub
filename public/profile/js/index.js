const AVATAR_COLORS = ['#4f6ef7', '#e05c97', '#20b090', '#e07c3a', '#9b59b6', '#2980b9', '#16a085'];

function pickColor(username) {
  return AVATAR_COLORS[username.charCodeAt(0) % AVATAR_COLORS.length];
}

function drawAvatar(canvas, initials, color) {
  const ctx = canvas.getContext('2d');
  const size = canvas.width;
  ctx.clearRect(0, 0, size, size);
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.floor(size * 0.38)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initials.toUpperCase(), size / 2, size / 2 + 1);
}

function getInitials(fullName, username) {
  if (fullName && fullName.trim()) {
    const parts = fullName.trim().split(/\s+/);
    return parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : parts[0][0];
  }
  return username[0];
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}

async function loadSession() {
  const res = await fetch('/api/auth/me');
  if (!res.ok) {
    window.location.href = '../login.html';
    return null;
  }
  return (await res.json()).username;
}

function targetUsername() {
  return new URLSearchParams(window.location.search).get('username');
}

function renderProfile(profile, sessionUsername) {
  const canvas = document.getElementById('avatar-canvas');
  drawAvatar(canvas, getInitials(profile.fullName, profile.username), pickColor(profile.username));

  document.getElementById('profile-fullname').textContent = profile.fullName || profile.username;
  document.getElementById('profile-username').textContent = '@' + profile.username;
  document.getElementById('profile-city').textContent = profile.city || '';
  document.getElementById('profile-member-since').textContent =
    profile.createdAt ? 'Member since ' + formatDate(profile.createdAt) : '';

  if (profile.isOwn) {
    document.getElementById('owner-actions').classList.remove('d-none');
    if (profile.email) {
      const emailEl = document.getElementById('profile-email');
      emailEl.textContent = profile.email;
      emailEl.classList.remove('d-none');
    }
  } else {
    const alreadyFriends = profile.friends.some(f => f.username === sessionUsername);
    if (!alreadyFriends) {
      document.getElementById('add-friend').classList.remove('d-none');
    } else {
      document.getElementById('remove-friend').classList.remove('d-none');
    }
  }

  renderInterests(profile.interests || []);
  renderFriends(profile.friends || []);
  renderGroups(profile.joinedGroups || []);
}

function renderInterests(interests) {
  const container = document.getElementById('interests-list');
  if (!interests.length) return;
  container.innerHTML = '';
  interests.forEach((tag) => {
    const span = document.createElement('span');
    span.className = 'interest-badge';
    span.textContent = tag;
    container.appendChild(span);
  });
}

function renderFriends(friends) {
  const list = document.getElementById('friends-list');
  document.getElementById('friends-count').textContent = friends.length || '';

  if (!friends.length) {
    list.innerHTML = '<li class="text-muted small">No friends added yet.</li>';
    return;
  }

  list.innerHTML = '';
  friends.forEach((friend) => {
    const name = friend.fullName || friend.username;
    const color = pickColor(friend.username);
    const li = document.createElement('li');
    li.className = 'friend-item';
    li.innerHTML = `
      <div class="friend-avatar" style="background:${color}">${name[0].toUpperCase()}</div>
      <div>
        <a href="index.html?username=${encodeURIComponent(friend.username)}" class="text-decoration-none text-dark fw-semibold small">${name}</a>
        ${friend.city ? `<div class="text-muted" style="font-size:0.72rem">${friend.city}</div>` : ''}
      </div>
    `;
    list.appendChild(li);
  });
}

function renderGroups(groups) {
  const container = document.getElementById('groups-list');
  document.getElementById('groups-count').textContent = groups.length || '';

  if (!groups.length) return;

  container.innerHTML = '';
  groups.forEach((group) => {
    const div = document.createElement('div');
    div.className = 'group-item';
    div.innerHTML = `<span class="fw-semibold small">${group.name || group}</span>`;
    container.appendChild(div);
  });
}

async function init() {
  const sessionUsername = await loadSession();
  if (!sessionUsername) return;

  document.getElementById('my-profile-link').href =
    'index.html?username=' + encodeURIComponent(sessionUsername);

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '../login.html';
  });

  const username = targetUsername() || sessionUsername;

  document.getElementById('add-friend-btn').addEventListener('click', async () => {
    await fetch('/api/users/' + encodeURIComponent(username) + '/friend', { method: 'POST' });
    document.getElementById('add-friend').classList.add('d-none');
    document.getElementById('remove-friend').classList.remove('d-none');
  });

  document.getElementById('remove-friend-btn').addEventListener('click', async () => {
    await fetch('/api/users/' + encodeURIComponent(username) + '/friend', { method: 'DELETE' });
    document.getElementById('remove-friend').classList.add('d-none');
    document.getElementById('add-friend').classList.remove('d-none');
  });

  const res = await fetch('/api/users/' + encodeURIComponent(username));

  if (!res.ok) {
    document.getElementById('not-found').classList.remove('d-none');
    return;
  }

  const profile = await res.json();
  document.title = `${profile.fullName || profile.username} — Volunteer Hub`;
  document.getElementById('profile-content').classList.remove('d-none');
  renderProfile(profile, sessionUsername);
}


init();