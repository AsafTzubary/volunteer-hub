async function loadSession() {
  const response = await fetch('/api/auth/me');

  if (!response.ok) {
    window.location.href = 'login.html';
    return;
  }

  const data = await response.json();
  document.getElementById('username-display').textContent = data.username;
}

document.getElementById('logout-btn').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = 'login.html';
});

loadSession();
