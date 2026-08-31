function debounce(fn, delayMs) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delayMs);
  };
}

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
      loadResults(readFiltersFromForm(), 1);
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

let searchRequestId = 0;
let currentFilters = {};
let currentPage = 1;

async function loadResults(filters, page = 1) {
  currentFilters = filters;
  renderActiveFilters(filters);
  const requestId = ++searchRequestId;

  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  params.set('page', page);

  const res = await fetch('/api/events/search?' + params.toString());

  if (requestId !== searchRequestId) {
    return;
  }

  const list = document.getElementById('results-list');

  if (!res.ok) {
    list.innerHTML = '<p class="text-muted small">Failed to load events.</p>';
    return;
  }

  const data = await res.json();

  if (requestId !== searchRequestId) {
    return;
  }

  currentPage = data.page;
  const hasActiveFilters = Object.entries(filters).some(([key, value]) => key !== 'sort' && value);

  if (data.events.length === 0) {
    list.innerHTML = hasActiveFilters
      ? '<p class="text-muted">No events match your search. Try adjusting the filters.</p>'
      : '<p class="text-muted">No events yet.</p>';
  } else {
    list.innerHTML = data.events.map(eventCard).join('');
  }

  document.getElementById('page-indicator').textContent = `Page ${data.page} of ${data.totalPages}`;
  document.getElementById('prev-page-btn').disabled = data.page <= 1;
  document.getElementById('next-page-btn').disabled = data.page >= data.totalPages;
}

const debouncedSearch = debounce(() => loadResults(readFiltersFromForm(), 1), 300);

async function init() {
  const sessionUsername = await loadSession();
  if (!sessionUsername) return;

  document.getElementById('my-profile-link').href = profileUrl(sessionUsername);
  wireLogout();

  document.getElementById('search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    loadResults(readFiltersFromForm(), 1);
  });

  document.getElementById('clear-filters-btn').addEventListener('click', () => {
    document.getElementById('search-form').reset();
    loadResults(readFiltersFromForm(), 1);
  });

  document.getElementById('prev-page-btn').addEventListener('click', () => {
    loadResults(currentFilters, currentPage - 1);
  });

  document.getElementById('next-page-btn').addEventListener('click', () => {
    loadResults(currentFilters, currentPage + 1);
  });

  document.getElementById('filter-address').addEventListener('input', debouncedSearch);
  document.getElementById('filter-category').addEventListener('input', debouncedSearch);
  document.getElementById('filter-date-from').addEventListener('change', debouncedSearch);
  document.getElementById('filter-date-to').addEventListener('change', debouncedSearch);
  document.getElementById('filter-status').addEventListener('change', debouncedSearch);
  document.getElementById('filter-sort').addEventListener('change', debouncedSearch);
  document.getElementById('filter-available-only').addEventListener('change', debouncedSearch);

  await loadResults(readFiltersFromForm(), 1);
}

init();
