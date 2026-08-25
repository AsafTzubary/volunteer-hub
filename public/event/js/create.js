function targetGroupId() {
  return new URLSearchParams(window.location.search).get('groupId');
}

async function init() {
  const sessionUsername = await loadSession();
  if (!sessionUsername) return;

  document.getElementById('my-profile-link').href = profileUrl(sessionUsername);
  wireLogout();

  const groupId = targetGroupId();
  if (!groupId) {
    window.location.href = '/group/list.html';
    return;
  }

  const res = await fetch('/api/groups/' + encodeURIComponent(groupId));
  if (!res.ok) {
    window.location.href = '/group/list.html';
    return;
  }

  const group = await res.json();
  if (!group.isManager) {
    window.location.href = '/group/index.html?id=' + encodeURIComponent(groupId);
    return;
  }

  document.getElementById('cancel-link').href = '/group/index.html?id=' + encodeURIComponent(groupId);
  document.getElementById('create-event-content').classList.remove('d-none');

  document.getElementById('create-event-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const errorBox = document.getElementById('form-error');
    errorBox.classList.add('d-none');

    const saveBtn = document.getElementById('save-btn');
    saveBtn.disabled = true;

    const latitude = document.getElementById('latitude').value;
    const longitude = document.getElementById('longitude').value;

    const payload = {
      groupId,
      title: document.getElementById('title').value.trim(),
      category: document.getElementById('category').value.trim(),
      description: document.getElementById('description').value.trim(),
      address: document.getElementById('address').value.trim(),
      date: document.getElementById('date').value,
      maxParticipants: document.getElementById('maxParticipants').value,
      ...(latitude !== '' && { latitude: Number(latitude) }),
      ...(longitude !== '' && { longitude: Number(longitude) }),
    };

    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      errorBox.textContent = data.error || 'Failed to create event.';
      errorBox.classList.remove('d-none');
      saveBtn.disabled = false;
      return;
    }

    window.location.href = '/group/index.html?id=' + encodeURIComponent(groupId);
  });
}

init();