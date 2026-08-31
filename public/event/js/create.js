let addressPicker = null;

function targetGroupId() {
  return new URLSearchParams(window.location.search).get('groupId');
}

async function init() {
  const session = await loadSession();
  if (!session) return;
  const { username: sessionUsername } = session;

  document.getElementById('my-profile-link').href = profileUrl(sessionUsername);
  wireLogout();

  const groupId = targetGroupId();
  if (!groupId) {
    window.location.href = '/group/list.html';
    return;
  }

  const res = await fetch('/api/groups/' + encodeURIComponent(groupId));
  if (!res.ok) {
    window.location.href = '/group/list.html';
    return;
  }

  const group = await res.json();
  if (!group.isManager) {
    window.location.href = '/group/index.html?id=' + encodeURIComponent(groupId);
    return;
  }

  document.getElementById('cancel-link').href = '/group/index.html?id=' + encodeURIComponent(groupId);
  document.getElementById('create-event-content').classList.remove('d-none');

  addressPicker = wireAddressAutocomplete({
    inputId: 'address-search',
    suggestionsId: 'address-suggestions',
    confirmedId: 'address-confirmed',
  });

  document.getElementById('create-event-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const errorBox = document.getElementById('form-error');
    errorBox.classList.add('d-none');

    const place = addressPicker.getPlace();
    if (addressPicker.getText() && !place) {
      errorBox.textContent = 'Select an address from the suggestions.';
      errorBox.classList.remove('d-none');
      return;
    }

    const saveBtn = document.getElementById('save-btn');
    saveBtn.disabled = true;

    const payload = {
      groupId,
      title: document.getElementById('title').value.trim(),
      category: document.getElementById('category').value.trim(),
      description: document.getElementById('description').value.trim(),
      address: place ? place.address : '',
      date: document.getElementById('date').value,
      maxParticipants: document.getElementById('maxParticipants').value,
      ...(place && { latitude: place.latitude, longitude: place.longitude }),
    };

    const submitRes = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await submitRes.json();

    if (!submitRes.ok) {
      errorBox.textContent = data.error || 'Failed to create event.';
      errorBox.classList.remove('d-none');
      saveBtn.disabled = false;
      return;
    }

    window.location.href = '/group/index.html?id=' + encodeURIComponent(groupId);
  });
}

init();
