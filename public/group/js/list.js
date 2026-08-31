const GROUPS_PAGE_SIZE = 9;
let currentPage = 1;
let currentFilters = {};

function groupCard(group) {
  const managerName = group.manager.fullName || group.manager.username;
  const memberLabel = group.memberCount === 1 ? 'member' : 'members';

  return `
    <div class="col-md-4">
      <a href="/group/index.html?id=${encodeURIComponent(group.id)}" class="text-decoration-none text-dark">
        <div class="card shadow-sm p-3 h-100">
          <span class="category-badge mb-2">${group.category}</span>
          <h2 class="h6 mb-1">${group.name}</h2>
          <p class="text-muted small mb-1">Managed by ${managerName}</p>
          <p class="text-muted small mb-0">${group.memberCount} ${memberLabel}</p>
        </div>
      </a>
    </div>
  `;
}

function readFiltersFromForm() {
  return {
    name: document.getElementById('filter-name').value.trim(),
    category: document.getElementById('filter-category').value.trim(),
    minMembers: document.getElementById('filter-min-members').value,
    maxMembers: document.getElementById('filter-max-members').value,
    createdFrom: document.getElementById('filter-created-from').value,
    createdTo: document.getElementById('filter-created-to').value,
  };
}

function hasActiveFilters(filters) {
  return Object.values(filters).some((value) => value !== '' && value !== undefined);
}

function buildGroupsQuery(page, filters) {
  const params = new URLSearchParams();
  params.set('page', page);
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== '' && value !== undefined) {
      params.set(key, value);
    }
  });
  return params.toString();
}

async function loadGroups(page, filters) {
  currentFilters = filters;
  const res = await fetch('/api/groups?' + buildGroupsQuery(page, filters));
  const data = await res.json();

  currentPage = data.page;

  const grid = document.getElementById('groups-grid');
  if (data.groups.length === 0) {
    grid.innerHTML = hasActiveFilters(filters)
      ? '<p class="text-muted">No groups match your search. Try adjusting the filters.</p>'
      : '<p class="text-muted">No groups yet.</p>';
  } else {
    grid.innerHTML = data.groups.map(groupCard).join('');
  }

  document.getElementById('page-indicator').textContent = `Page ${data.page} of ${data.totalPages}`;
  document.getElementById('prev-page-btn').disabled = data.page <= 1;
  document.getElementById('next-page-btn').disabled = data.page >= data.totalPages;
}

async function init() {
  const session = await loadSession();
  if (!session) return;
  const { username: sessionUsername } = session;

  document.getElementById('my-profile-link').href = profileUrl(sessionUsername);
  wireLogout();

  document.getElementById('prev-page-btn').addEventListener('click', () => loadGroups(currentPage - 1, currentFilters));
  document.getElementById('next-page-btn').addEventListener('click', () => loadGroups(currentPage + 1, currentFilters));

  document.getElementById('search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    loadGroups(1, readFiltersFromForm());
  });

  document.getElementById('clear-filters-btn').addEventListener('click', () => {
    document.getElementById('search-form').reset();
    loadGroups(1, {});
  });

  await loadGroups(1, {});
}

init();