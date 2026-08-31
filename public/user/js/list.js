const AVATAR_COLORS = ['#4f6ef7', '#e05c97', '#20b090', '#e07c3a', '#9b59b6', '#2980b9', '#16a085'];

function pickColor(username) {
  return AVATAR_COLORS[username.charCodeAt(0) % AVATAR_COLORS.length];
}

function getInitials(fullName, username) {
  if (fullName && fullName.trim()) {
    const parts = fullName.trim().split(/\s+/);
    return parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : parts[0][0];
  }
  return username[0];
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function debounce(fn, delayMs) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delayMs);
  };
}

const FILTER_LABELS = {
  name: 'Name',
  city: 'City',
  interest: 'Interest',
  createdFrom: 'Joined from',
  createdTo: 'Joined to',
  friendsOnly: 'Friends only',
};

const FILTER_FIELD_IDS = {
  name: 'filter-name',
  city: 'filter-city',
  interest: 'filter-interest',
  createdFrom: 'filter-joined-from',
  createdTo: 'filter-joined-to',
  friendsOnly: 'filter-friends-only',
  sort: 'filter-sort',
};

function formatJoined(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}

function friendCountLabel(count) {
  return count + (count === 1 ? ' friend' : ' friends');
}

function readFiltersFromForm() {
  return {
    name: document.getElementById(FILTER_FIELD_IDS.name).value.trim(),
    city: document.getElementById(FILTER_FIELD_IDS.city).value.trim(),
    interest: document.getElementById(FILTER_FIELD_IDS.interest).value.trim(),
    createdFrom: document.getElementById(FILTER_FIELD_IDS.createdFrom).value,
    createdTo: document.getElementById(FILTER_FIELD_IDS.createdTo).value,
    friendsOnly: document.getElementById(FILTER_FIELD_IDS.friendsOnly).checked ? 'true' : '',
    sort: document.getElementById(FILTER_FIELD_IDS.sort).value,
  };
}

function clearFilterField(key) {
  const field = document.getElementById(FILTER_FIELD_IDS[key]);
  if (field.type === 'checkbox') {
    field.checked = false;
  } else {
    field.value = '';
  }
}

function renderActiveFilters(filters) {
  const container = document.getElementById('active-filters');
  const chips = Object.entries(FILTER_LABELS)
    .filter(([key]) => filters[key])
    .map(([key, label]) => {
      const value = key === 'friendsOnly' ? 'Yes' : filters[key];
      return `
        <span class="badge bg-light text-dark border d-inline-flex align-items-center gap-1">
          ${label}: ${escapeHtml(value)}
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

function friendControl(user) {
  if (user.isSelf) {
    return '<span class="badge bg-secondary">This is you</span>';
  }
  const label = user.isFriend ? 'Remove Friend' : 'Add Friend';
  const styleClass = user.isFriend ? 'btn-outline-danger' : 'btn-outline-primary';
  return `
    <button type="button" class="btn btn-sm ${styleClass}" data-friend-btn
            data-username="${escapeHtml(user.username)}" data-is-friend="${user.isFriend}">${label}</button>
  `;
}

const MAX_INTERESTS_SHOWN = 3;

function interestBadges(interests) {
  if (!interests.length) return '';
  const shown = interests
    .slice(0, MAX_INTERESTS_SHOWN)
    .map((tag) => `<span class="interest-badge">${escapeHtml(tag)}</span>`)
    .join(' ');
  const hidden = interests.length - MAX_INTERESTS_SHOWN;
  const more = hidden > 0 ? ` <span class="text-muted" style="font-size:0.72rem">+${hidden} more</span>` : '';
  return `<div class="d-flex flex-wrap gap-1 align-items-center mb-2">${shown}${more}</div>`;
}

function userCard(user) {
  const displayName = user.fullName || user.username;
  const initials = getInitials(user.fullName, user.username).toUpperCase();

  return `
    <div class="col-md-6 col-lg-4" data-user-card data-username="${escapeHtml(user.username)}">
      <div class="card user-card shadow-sm p-3 h-100">
        <div class="d-flex align-items-center gap-2 mb-2">
          <div class="user-avatar" style="background:${pickColor(user.username)}">${escapeHtml(initials)}</div>
          <div class="user-identity">
            <a href="${profileUrl(user.username)}" class="text-decoration-none fw-semibold d-block text-truncate">${escapeHtml(displayName)}</a>
            <span class="text-muted d-block text-truncate" style="font-size:0.72rem">@${escapeHtml(user.username)}</span>
          </div>
        </div>
        ${user.city ? `<p class="text-muted small mb-1">${escapeHtml(user.city)}</p>` : ''}
        ${interestBadges(user.interests || [])}
        <p class="text-muted small mb-1">
          <span data-friend-count="${user.friendCount}">${friendCountLabel(user.friendCount)}</span>
          &middot; ${user.groupCount} groups
        </p>
        <p class="text-muted mb-3" style="font-size:0.72rem">Member since ${formatJoined(user.createdAt)}</p>
        <div class="mt-auto">${friendControl(user)}</div>
      </div>
    </div>
  `;
}

let statusTimeoutId;

function showStatus(message) {
  const el = document.getElementById('status-message');
  el.textContent = message;
  el.classList.remove('d-none');
  clearTimeout(statusTimeoutId);
  statusTimeoutId = setTimeout(() => el.classList.add('d-none'), 4000);
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

  const res = await fetch('/api/users?' + params.toString());

  if (requestId !== searchRequestId) {
    return;
  }

  const grid = document.getElementById('users-grid');

  if (!res.ok) {
    grid.innerHTML = '<p class="text-muted small">Failed to load users.</p>';
    return;
  }

  const data = await res.json();

  if (requestId !== searchRequestId) {
    return;
  }

  currentPage = data.page;
  const hasActiveFilters = Object.entries(filters).some(([key, value]) => key !== 'sort' && value);

  if (data.users.length === 0) {
    grid.innerHTML = hasActiveFilters
      ? '<p class="text-muted">No users match your search. Try adjusting the filters.</p>'
      : '<p class="text-muted">No users yet.</p>';
  } else {
    grid.innerHTML = data.users.map(userCard).join('');
  }

  document.getElementById('results-count').textContent =
    data.totalCount === 1 ? '1 user' : `${data.totalCount} users`;
  document.getElementById('page-indicator').textContent = `Page ${data.page} of ${data.totalPages}`;
  document.getElementById('prev-page-btn').disabled = data.page <= 1;
  document.getElementById('next-page-btn').disabled = data.page >= data.totalPages;
}

function setFriendButtonState(btn, isFriend) {
  btn.dataset.isFriend = String(isFriend);
  btn.textContent = isFriend ? 'Remove Friend' : 'Add Friend';
  btn.classList.toggle('btn-outline-danger', isFriend);
  btn.classList.toggle('btn-outline-primary', !isFriend);
}

function bumpFriendCount(card, delta) {
  const countEl = card.querySelector('[data-friend-count]');
  if (!countEl) return;
  const next = Math.max(0, Number(countEl.dataset.friendCount) + delta);
  countEl.dataset.friendCount = String(next);
  countEl.textContent = friendCountLabel(next);
}

async function toggleFriend(btn) {
  const card = btn.closest('[data-user-card]');
  const username = btn.dataset.username;
  const wasFriend = btn.dataset.isFriend === 'true';

  btn.disabled = true;
  const res = await fetch('/api/users/' + encodeURIComponent(username) + '/friend', {
    method: wasFriend ? 'DELETE' : 'POST',
  });
  btn.disabled = false;

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    showStatus(data.error || 'Could not update that friendship. Please try again.');
    return;
  }

  if (wasFriend && currentFilters.friendsOnly) {
    await loadResults(currentFilters, currentPage);
    return;
  }

  setFriendButtonState(btn, !wasFriend);
  bumpFriendCount(card, wasFriend ? -1 : 1);
}

const debouncedSearch = debounce(() => loadResults(readFiltersFromForm(), 1), 300);

async function init() {
  const session = await loadSession();
  if (!session) return;

  document.getElementById('my-profile-link').href = profileUrl(session.username);
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

  document.getElementById('users-grid').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-friend-btn]');
    if (btn) toggleFriend(btn);
  });

  document.getElementById(FILTER_FIELD_IDS.name).addEventListener('input', debouncedSearch);
  document.getElementById(FILTER_FIELD_IDS.city).addEventListener('input', debouncedSearch);
  document.getElementById(FILTER_FIELD_IDS.interest).addEventListener('input', debouncedSearch);
  document.getElementById(FILTER_FIELD_IDS.createdFrom).addEventListener('change', debouncedSearch);
  document.getElementById(FILTER_FIELD_IDS.createdTo).addEventListener('change', debouncedSearch);
  document.getElementById(FILTER_FIELD_IDS.friendsOnly).addEventListener('change', debouncedSearch);
  document.getElementById(FILTER_FIELD_IDS.sort).addEventListener('change', debouncedSearch);

  await loadResults(readFiltersFromForm(), 1);
}

init();
