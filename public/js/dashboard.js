function renderJoinedGroups(groups) {
  const list = document.getElementById('joined-groups-list');
  if (!groups.length) {
    list.innerHTML = '<li class="text-muted small">You haven\'t joined any groups yet.</li>';
    return;
  }
  list.innerHTML = groups.map((group) => `
    <li class="mb-1">
      <a href="/group/index.html?id=${encodeURIComponent(group._id)}" class="text-decoration-none small">${group.name}</a>
    </li>
  `).join('');
}

async function init() {
  const sessionUsername = await loadSession();
  if (!sessionUsername) return;

  const profileUrl_ = profileUrl(sessionUsername);
  document.getElementById('my-profile-link').href = profileUrl_;
  document.getElementById('profile-link').href = profileUrl_;
  wireLogout();

  const res = await fetch('/api/users/' + encodeURIComponent(sessionUsername));
  if (!res.ok) return;
  const user = await res.json();

  const displayName = user.fullName || user.username;
  document.getElementById('profile-avatar').textContent = displayName[0].toUpperCase();
  document.getElementById('profile-name').textContent = displayName;
  document.getElementById('profile-city').textContent = user.city || '';

  renderJoinedGroups(user.joinedGroups || []);
}

init();
