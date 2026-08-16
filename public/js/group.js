async function loadSession() {
  const res = await fetch('/api/auth/me');
  if (!res.ok) {
    window.location.href = 'login.html';
    return null;
  }
  return (await res.json()).username;
}

function targetGroupId() {
  return new URLSearchParams(window.location.search).get('id');
}

function personRow(person) {
  const name = person.fullName || person.username;
  return `
    <div class="friend-avatar">${name[0].toUpperCase()}</div>
    <div>
      <a href="profile/index.html?username=${encodeURIComponent(person.username)}" class="text-decoration-none text-dark fw-semibold small">${name}</a>
      ${person.city ? `<div class="text-muted" style="font-size:0.72rem">${person.city}</div>` : ''}
    </div>
  `;
}

function renderManager(manager) {
  const container = document.getElementById('manager-info');
  container.className = 'friend-item';
  container.innerHTML = personRow(manager);
}

function renderMembers(members) {
  const list = document.getElementById('members-list');
  document.getElementById('members-count').textContent = members.length || '';

  if (!members.length) {
    list.innerHTML = '<li class="text-muted small">No members yet.</li>';
    return;
  }

  list.innerHTML = '';
  members.forEach((member) => {
    const li = document.createElement('li');
    li.className = 'friend-item';
    li.innerHTML = personRow(member);
    list.appendChild(li);
  });
}

function renderActionButtons(group) {
  if (group.isManager) {
    const editBtn = document.getElementById('edit-group-btn');
    editBtn.href = 'edit-group.html?id=' + encodeURIComponent(group.id);
    editBtn.classList.remove('d-none');
    document.getElementById('delete-group-btn').classList.remove('d-none');
  } else if (group.isMember) {
    document.getElementById('leave-group-btn').classList.remove('d-none');
  } else {
    document.getElementById('join-group-btn').classList.remove('d-none');
  }
}

function renderGroup(group) {
  document.getElementById('group-name').textContent = group.name;
  document.getElementById('group-category').textContent = group.category;
  document.getElementById('group-address').textContent = group.address || '';
  document.getElementById('group-description').textContent =
    group.description || 'No description provided.';

  renderManager(group.manager);
  renderMembers(group.members);
  renderActionButtons(group);
}

async function init() {
  const sessionUsername = await loadSession();
  if (!sessionUsername) return;

  document.getElementById('my-profile-link').href =
    'profile/index.html?username=' + encodeURIComponent(sessionUsername);

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = 'login.html';
  });

  const groupId = targetGroupId();
  if (!groupId) {
    document.getElementById('not-found').classList.remove('d-none');
    return;
  }

  const res = await fetch('/api/groups/' + encodeURIComponent(groupId));
  if (!res.ok) {
    document.getElementById('not-found').classList.remove('d-none');
    return;
  }

  const group = await res.json();
  document.title = `${group.name} — Volunteer Hub`;
  document.getElementById('group-content').classList.remove('d-none');
  renderGroup(group);
}

init();