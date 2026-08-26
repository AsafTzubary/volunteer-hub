async function init() {
  const sessionUsername = await loadSession();
  if (!sessionUsername) return;

  document.getElementById('my-profile-link').href = profileUrl(sessionUsername);
  wireLogout();

  const mineRes = await fetch('/api/groups/mine');
  if (mineRes.ok) {
    const { id } = await mineRes.json();
    window.location.href = '/group/index.html?id=' + encodeURIComponent(id);
    return;
  }

  document.getElementById('create-group-content').classList.remove('d-none');

  document.getElementById('create-group-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const errorBox = document.getElementById('form-error');
    errorBox.classList.add('d-none');

    const saveBtn = document.getElementById('save-btn');
    saveBtn.disabled = true;

    const payload = {
      name: document.getElementById('name').value.trim(),
      category: document.getElementById('category').value.trim(),
      description: document.getElementById('description').value.trim(),
    };

    const res = await fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      if (res.status === 409 && data.groupId) {
        window.location.href = '/group/index.html?id=' + encodeURIComponent(data.groupId);
        return;
      }
      errorBox.textContent = data.error || 'Failed to create group.';
      errorBox.classList.remove('d-none');
      saveBtn.disabled = false;
      return;
    }

    window.location.href = '/group/index.html?id=' + encodeURIComponent(data.id);
  });
}

init();