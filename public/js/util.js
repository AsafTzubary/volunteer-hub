async function loadSession() {
  const res = await fetch('/api/auth/me');
  if (!res.ok) {
    window.location.href = '/login.html';
    return null;
  }
  return (await res.json()).username;
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