function targetGroupId() {
  return new URLSearchParams(window.location.search).get('id');
}

function personRow(person, showRemove) {
  const name = person.fullName || person.username;
  return `
    <div class="member-avatar">${name[0].toUpperCase()}</div>
    <div>
      <a href="${profileUrl(person.username)}" class="text-decoration-none text-dark fw-semibold small">${name}</a>
      ${person.city ? `<div class="text-muted" style="font-size:0.72rem">${person.city}</div>` : ''}
    </div>
    <div>
      ${showRemove ? `<button class="btn btn-sm btn-outline-danger remove-member-btn" data-username="${person.username}">Remove</button>` : ''}
    </div>
      `;
}

function renderManager(manager) {
  const container = document.getElementById('manager-info');
  container.className = 'member-item';
  container.innerHTML = personRow(manager);
}

function renderMembers(members, isManager, groupId) {
  const list = document.getElementById('members-list');
  document.getElementById('members-count').textContent = members.length || '';

  if (!members.length) {
    list.innerHTML = '<li class="text-muted small">No members yet.</li>';
    return;
  }

  list.innerHTML = '';
  members.forEach((member) => {
    const li = document.createElement('li');
    li.className = 'member-item';
    li.innerHTML = personRow(member, isManager);
    list.appendChild(li);
  });

  list.querySelectorAll('.remove-member-btn').forEach((btn) => {
  btn.addEventListener('click', () => handleRemoveMember(groupId, btn.dataset.username, btn));
  });
}

async function handleJoin(groupId) {
  const btn = document.getElementById('join-group-btn');
  btn.disabled = true;
  const res = await fetch('/api/groups/' + encodeURIComponent(groupId) + '/join', { method: 'POST' });
  const data = await res.json();
  if (!res.ok) {
    alert(data.error || 'Failed to join group.');
    btn.disabled = false;
    return;
  }

  btn.classList.add('d-none');

  const leaveBtn = document.getElementById('leave-group-btn');
  leaveBtn.classList.remove('d-none');
  leaveBtn.disabled = false;
  leaveBtn.addEventListener('click', () => handleLeave(groupId));
  await refreshMembers(groupId);
}

async function handleLeave(groupId) {
  const btn = document.getElementById('leave-group-btn');
  btn.disabled = true;
  const res = await fetch('/api/groups/' + encodeURIComponent(groupId) + '/leave', { method: 'POST' });
  const data = await res.json();
  if (!res.ok) {
    alert(data.error || 'Failed to leave group.');
    btn.disabled = false;
    return;
  }
  
  btn.classList.add('d-none');

  const joinBtn = document.getElementById('join-group-btn');
  joinBtn.classList.remove('d-none');
  joinBtn.disabled = false;
  joinBtn.addEventListener('click', () => handleJoin(groupId));
  await refreshMembers(groupId);
}

function renderActionButtons(group) {
  if (group.isManager) {
    const editBtn = document.getElementById('edit-group-btn');
    editBtn.href = '/group/edit.html?id=' + encodeURIComponent(group.id);
    editBtn.classList.remove('d-none');
    document.getElementById('delete-group-btn').classList.remove('d-none');
  } else if (group.isMember) {
    const leaveBtn = document.getElementById('leave-group-btn');
    leaveBtn.classList.remove('d-none');
    leaveBtn.disabled = false;
    leaveBtn.addEventListener('click', () => handleLeave(group.id));
  } else {
    const joinBtn = document.getElementById('join-group-btn');
    joinBtn.classList.remove('d-none');
    joinBtn.disabled = false;
    joinBtn.addEventListener('click', () => handleJoin(group.id));
  }
}

function renderGroup(group) {
  document.getElementById('group-name').textContent = group.name;
  document.getElementById('group-category').textContent = group.category;
  document.getElementById('group-address').textContent = group.address || '';
  document.getElementById('group-description').textContent =
    group.description || 'No description provided.';

  renderManager(group.manager);
  renderMembers(group.members, group.isManager, group.id);
  renderActionButtons(group);
}

async function refreshMembers(groupId) {
  const res = await fetch('/api/groups/' + encodeURIComponent(groupId));
  if (!res.ok) return;
  const group = await res.json();
  renderManager(group.manager);
  renderMembers(group.members, group.isManager, group.id);
}

async function init() {
  const sessionUsername = await loadSession();
  if (!sessionUsername) return;

  document.getElementById('my-profile-link').href = profileUrl(sessionUsername);
  wireLogout();

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

async function handleRemoveMember(groupId, username, btn){
  btn.disabled = true;
  const res = await fetch('/api/groups/' + encodeURIComponent(groupId) + '/members/' + encodeURIComponent(username), { method: 'DELETE' });
  const data = await res.json();
  if (!res.ok) {
    alert(data.error || 'Failed to remove member from.');
    btn.disabled = false;
    return;
  } else {
    btn.closest('li').remove()
    document.getElementById('members-count').textContent = document.getElementById('members-list').children.length || '';
  }
}

init();