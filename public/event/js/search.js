const FILTER_LABELS = {
  address: 'Address',
  category: 'Category',
  dateFrom: 'From',
  dateTo: 'To',
  status: 'Status',
  availableOnly: 'Available only',
};

const STATUS_BADGE_CLASS = {
  upcoming: 'bg-primary',
  full: 'bg-warning text-dark',
  completed: 'bg-secondary',
  cancelled: 'bg-danger',
};

function formatEventDate(iso) {
  return new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

function readFiltersFromForm() {
  return {
    address: document.getElementById('filter-address').value.trim(),
    category: document.getElementById('filter-category').value.trim(),
    dateFrom: document.getElementById('filter-date-from').value,
    dateTo: document.getElementById('filter-date-to').value,
    status: document.getElementById('filter-status').value,
    availableOnly: document.getElementById('filter-available-only').checked ? 'true' : '',
    sort: document.getElementById('filter-sort').value,
  };
}

function clearFilterField(key) {
  if (key === 'availableOnly') {
    document.getElementById('filter-available-only').checked = false;
  } else if (key === 'status') {
    document.getElementById('filter-status').value = '';
  } else if (key === 'address') {
    document.getElementById('filter-address').value = '';
  } else if (key === 'category') {
    document.getElementById('filter-category').value = '';
  } else if (key === 'dateFrom') {
    document.getElementById('filter-date-from').value = '';
  } else if (key === 'dateTo') {
    document.getElementById('filter-date-to').value = '';
  }
}

function renderActiveFilters(filters) {
  const container = document.getElementById('active-filters');
  const chips = Object.entries(FILTER_LABELS)
    .filter(([key]) => filters[key])
    .map(([key, label]) => {
      const value = key === 'availableOnly' ? 'Yes' : filters[key];
      return `
        <span class="badge bg-light text-dark border d-inline-flex align-items-center gap-1">
          ${label}: ${value}
          <button type="button" class="btn-close btn-close-sm" style="font-size:0.55rem" data-filter-key="${key}" aria-label="Remove filter"></button>
        </span>
      `;
    });

  container.innerHTML = chips.join('');
  container.querySelectorAll('[data-filter-key]').forEach((btn) => {
    btn.addEventListener('click', () => {
      clearFilterField(btn.dataset.filterKey);
      loadResults(readFiltersFromForm());
    });
  });
}

function eventCard(event) {
  const managerName = event.manager.fullName || event.manager.username;
  const badgeClass = STATUS_BADGE_CLASS[event.status] || 'bg-secondary';

  return `
    <div class="card shadow-sm p-3">
      <div class="d-flex justify-content-between align-items-start mb-1">
        <a href="/event/index.html?id=${encodeURIComponent(event.id)}" class="fw-semibold text-decoration-none">${event.title}</a>
        <div class="d-flex gap-1">
          <span class="badge ${badgeClass}">${event.status}</span>
          <span class="category-badge">${event.category}</span>
        </div>
      </div>
      <p class="text-muted small mb-1">${formatEventDate(event.date)}</p>
      ${event.address ? `<p class="text-muted small mb-1">${event.address}</p>` : ''}
      <p class="text-muted small mb-0">${event.group.name} &middot; ${event.participantsCount}/${event.maxParticipants} participants &middot; ${managerName}</p>
    </div>
  `;
}

async function loadResults(filters) {
  renderActiveFilters(filters);

  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });

  const res = await fetch('/api/events/search?' + params.toString());
  const list = document.getElementById('results-list');

  if (!res.ok) {
    list.innerHTML = '<p class="text-muted small">Failed to load events.</p>';
    return;
  }

  const events = await res.json();
  const hasActiveFilters = Object.entries(filters).some(([key, value]) => key !== 'sort' && value);

  if (events.length === 0) {
    list.innerHTML = hasActiveFilters
      ? '<p class="text-muted">No events match your search. Try adjusting the filters.</p>'
      : '<p class="text-muted">No events yet.</p>';
    return;
  }

  list.innerHTML = events.map(eventCard).join('');
}

async function init() {
  const sessionUsername = await loadSession();
  if (!sessionUsername) return;

  document.getElementById('my-profile-link').href = profileUrl(sessionUsername);
  wireLogout();

  document.getElementById('search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    loadResults(readFiltersFromForm());
  });

  document.getElementById('clear-filters-btn').addEventListener('click', () => {
    document.getElementById('search-form').reset();
    loadResults(readFiltersFromForm());
  });

  await loadResults(readFiltersFromForm());
}

init();
