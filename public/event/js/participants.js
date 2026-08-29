function targetEventId() {
  return new URLSearchParams(window.location.search).get('id');
}

function participantRow(participant) {
  return `
    <tr>
      <td>${participant.fullName || participant.username}</td>
      <td>${participant.username}</td>
      <td>${participant.city || '—'}</td>
    </tr>
  `;
}

async function init() {
  const sessionUsername = await loadSession();
  if (!sessionUsername) return;

  document.getElementById('my-profile-link').href = profileUrl(sessionUsername);
  wireLogout();

  const eventId = targetEventId();
  if (!eventId) {
    window.location.href = '/event/map.html';
    return;
  }

  document.getElementById('back-link').href = '/event/index.html?id=' + encodeURIComponent(eventId);

  const res = await fetch('/api/events/' + encodeURIComponent(eventId) + '/participants');

  if (res.status === 403) {
    document.getElementById('not-authorized').classList.remove('d-none');
    return;
  }
  if (!res.ok) {
    document.getElementById('not-found').classList.remove('d-none');
    return;
  }

  const data = await res.json();

  if (data.participants.length === 0) {
    document.getElementById('empty-state').classList.remove('d-none');
    return;
  }

  document.getElementById('participants-body').innerHTML =
    data.participants.map(participantRow).join('');
  document.getElementById('participants-table-wrap').classList.remove('d-none');
}

init();
