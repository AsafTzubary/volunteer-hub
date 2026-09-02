async function loadSession() {
  const res = await fetch('/api/auth/me');
  if (!res.ok) {
    window.location.href = '/login.html';
    return null;
  }
  return await res.json();
}

function wireLogout() {
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login.html';
  });
}

function profileUrl(username) {
  return '/profile/index.html?username=' + encodeURIComponent(username);
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
