function targetEventId() {
  return new URLSearchParams(window.location.search).get('id');
}

function formatEventDate(iso){
  return new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

function renderEvent(event) {
  document.getElementById('event-title').textContent = event.title;
  document.getElementById('event-category').textContent = event.category;
  document.getElementById('event-date').textContent = formatEventDate(event.date);
  document.getElementById('event-address').textContent = event.address;
  document.getElementById('event-description').textContent =
    event.description || 'No description provided.';
  document.getElementById('manager-info').textContent = event.manager.fullName || event.manager.username;

  const groupLink = document.getElementById('event-group-link');
  groupLink.textContent = event.group.name;
  groupLink.href = '/group/index.html?id=' + encodeURIComponent(event.group._id);

  document.getElementById('event-participants').textContent =
    `${event.participantsCount} of ${event.maxParticipants} registered — ${event.availablePlaces} spots left`;

  if (event.isManager) {
    document.getElementById('manager-badge').classList.remove('d-none');
    const editBtn = document.getElementById('edit-event-btn');
    editBtn.href = '/event/edit.html?id=' + encodeURIComponent(event.id);
    editBtn.classList.remove('d-none');
  }
  if (event.isParticipant) {
    document.getElementById('participant-badge').classList.remove('d-none');
  }
}

async function init() {
  const sessionUsername = await loadSession();
  if (!sessionUsername) return;
  document.getElementById('my-profile-link').href = profileUrl(sessionUsername);
  wireLogout();
  const eventId = targetEventId();
  if (!eventId) {
    document.getElementById('not-found').classList.remove('d-none');
    return;
  }

  const res = await fetch('/api/events/' + encodeURIComponent(eventId));
  if (!res.ok) {
    document.getElementById('not-found').classList.remove('d-none');
    return;
  }
  const event = await res.json();
  document.title = `${event.title} — Volunteer Hub`;
  document.getElementById('event-content').classList.remove('d-none');
  renderEvent(event);

}

init();
