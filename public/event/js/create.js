let selectedAddress = '';
let selectedLatitude = null;
let selectedLongitude = null;
let debounceTimer = null;

function targetGroupId() {
  return new URLSearchParams(window.location.search).get('groupId');
}

function showAddressLookupError(suggestionsList) {
  suggestionsList.innerHTML =
    '<li class="list-group-item small text-muted">Address lookup is unavailable right now. You can keep filling in the rest of the form.</li>';
  suggestionsList.classList.remove('d-none');
}

function wireAddressSearch() {
  const searchInput = document.getElementById('address-search');
  const suggestionsList = document.getElementById('address-suggestions');
  const confirmedEl = document.getElementById('address-confirmed');

  searchInput.addEventListener('input', function () {
    clearTimeout(debounceTimer);
    selectedAddress = '';
    selectedLatitude = null;
    selectedLongitude = null;
    confirmedEl.classList.add('d-none');

    const q = this.value.trim();
    if (q.length < 2) {
      suggestionsList.classList.add('d-none');
      suggestionsList.innerHTML = '';
      return;
    }

    debounceTimer = setTimeout(async () => {
      const res = await fetchWithoutErrorPage('/api/places/autocomplete?q=' + encodeURIComponent(q));
      if (!res.ok) {
        showAddressLookupError(suggestionsList);
        return;
      }
      const data = await res.json();

      suggestionsList.innerHTML = '';
      if (!data.suggestions.length) {
        suggestionsList.classList.add('d-none');
        return;
      }

      data.suggestions.forEach((s) => {
        const li = document.createElement('li');
        li.className = 'list-group-item list-group-item-action small';
        li.textContent = s.description;
        li.addEventListener('click', async () => {
          suggestionsList.classList.add('d-none');
          searchInput.value = s.description;

          const detailRes = await fetchWithoutErrorPage('/api/places/details?placeId=' + encodeURIComponent(s.placeId));
          if (!detailRes.ok) {
            showAddressLookupError(suggestionsList);
            return;
          }
          const detail = await detailRes.json();

          selectedAddress = detail.address;
          selectedLatitude = detail.latitude;
          selectedLongitude = detail.longitude;

          confirmedEl.textContent = '✓ ' + detail.address;
          confirmedEl.classList.remove('d-none');
        });
        suggestionsList.appendChild(li);
      });

      suggestionsList.classList.remove('d-none');
    }, 300);
  });

  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !suggestionsList.contains(e.target)) {
      suggestionsList.classList.add('d-none');
    }
  });
}

async function init() {
  const sessionUsername = await loadSession();
  if (!sessionUsername) return;

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

  wireAddressSearch();

  document.getElementById('create-event-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const errorBox = document.getElementById('form-error');
    errorBox.classList.add('d-none');

    const saveBtn = document.getElementById('save-btn');
    saveBtn.disabled = true;

    const payload = {
      groupId,
      title: document.getElementById('title').value.trim(),
      category: document.getElementById('category').value.trim(),
      description: document.getElementById('description').value.trim(),
      address: selectedAddress,
      date: document.getElementById('date').value,
      maxParticipants: document.getElementById('maxParticipants').value,
      ...(selectedLatitude !== null && { latitude: selectedLatitude }),
      ...(selectedLongitude !== null && { longitude: selectedLongitude }),
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
