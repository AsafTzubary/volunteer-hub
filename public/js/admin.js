async function init() {
  const res = await fetch('/api/auth/me');
  if (!res.ok) {
    window.location.href = '/login.html';
    return;
  }
  const { username, role } = await res.json();
  if (role !== 'admin') {
    window.location.href = '/dashboard.html';
    return;
  }
  document.getElementById('my-profile-link').href = profileUrl(username);
  wireLogout();
}

init();
