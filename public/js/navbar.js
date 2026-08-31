document.querySelector('nav').innerHTML = `
  <div class="container">
    <a class="navbar-brand" href="/dashboard.html">Volunteer Hub</a>
    <div class="d-flex gap-2 align-items-center">
      <a id="admin-panel-btn" href="/admin.html" class="btn btn-outline-warning btn-sm d-none">Admin Panel</a>
      <a id="my-profile-link" href="#" class="btn btn-outline-light btn-sm">My Profile</a>
      <button id="logout-btn" class="btn btn-outline-light btn-sm">Log Out</button>
    </div>
  </div>
`;

(async () => {
  const session = await loadSession();
  if (isAdmin(session)) {
    document.getElementById('admin-panel-btn').classList.remove('d-none');
  }
})();
