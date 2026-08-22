const GROUPS_PAGE_SIZE = 9;
let currentPage = 1;

function groupCard(group) {
  const managerName = group.manager.fullName || group.manager.username;
  const memberLabel = group.memberCount === 1 ? 'member' : 'members';

  return `
    <div class="col-md-4">
      <a href="/group/index.html?id=${encodeURIComponent(group.id)}" class="text-decoration-none text-dark">
        <div class="card shadow-sm p-3 h-100">
          <span class="category-badge mb-2">${group.category}</span>
          <h2 class="h6 mb-1">${group.name}</h2>
          <p class="text-muted small mb-1">${group.address || 'No address listed'}</p>
          <p class="text-muted small mb-1">Managed by ${managerName}</p>
          <p class="text-muted small mb-0">${group.memberCount} ${memberLabel}</p>
        </div>
      </a>
    </div>
  `;
}

async function loadGroups(page) {
  const res = await fetch('/api/groups?page=' + page);
  const data = await res.json();

  currentPage = data.page;

  const grid = document.getElementById('groups-grid');
  grid.innerHTML = data.groups.length
    ? data.groups.map(groupCard).join('')
    : '<p class="text-muted">No groups yet.</p>';

  document.getElementById('page-indicator').textContent = `Page ${data.page} of ${data.totalPages}`;
  document.getElementById('prev-page-btn').disabled = data.page <= 1;
  document.getElementById('next-page-btn').disabled = data.page >= data.totalPages;
}

async function init() {
  const sessionUsername = await loadSession();
  if (!sessionUsername) return;

  document.getElementById('my-profile-link').href = profileUrl(sessionUsername);
  wireLogout();

  document.getElementById('prev-page-btn').addEventListener('click', () => loadGroups(currentPage - 1));
  document.getElementById('next-page-btn').addEventListener('click', () => loadGroups(currentPage + 1));

  await loadGroups(1);
}

init();