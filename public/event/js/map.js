function formatEventDate(iso) {
  return new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

function eventCard(event) {
  const managerName = event.manager.fullName || event.manager.username;
  return `
    <div class="card shadow-sm p-3">
      <div class="d-flex justify-content-between align-items-start mb-1">
        <span class="fw-semibold small">${event.title}</span>
        <span class="category-badge ms-2">${event.category}</span>
      </div>
      <p class="text-muted small mb-1">${formatEventDate(event.date)}</p>
      ${event.address ? `<p class="text-muted small mb-1">${event.address}</p>` : ''}
      <p class="text-muted small mb-0">${event.group.name} · ${event.participantsCount}/${event.maxParticipants} participants · ${managerName}</p>
    </div>
  `;
}

async function init() {
  const sessionUsername = await loadSession();
  if (!sessionUsername) return;

  document.getElementById('my-profile-link').href = profileUrl(sessionUsername);
  wireLogout();

  const res = await fetch('/api/events/all');
  const list = document.getElementById('events-list');

  if (!res.ok) {
    list.innerHTML = '<p class="text-muted small">Failed to load events.</p>';
    return;
  }

  const events = await res.json();
  list.innerHTML = events.length
    ? events.map(eventCard).join('')
    : '<p class="text-muted small">No upcoming events.</p>';
}

init();
