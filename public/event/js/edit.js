function targetEventId() {
  return new URLSearchParams(window.location.search).get('id');
}

function toDatetimeLocal(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function populateForm(event) {
  document.getElementById('title').value = event.title || '';
  document.getElementById('category').value = event.category || '';
  document.getElementById('description').value = event.description || '';
  document.getElementById('date').value = toDatetimeLocal(event.date);
  document.getElementById('address').value = event.address || '';
  document.getElementById('maxParticipants').value = event.maxParticipants || '';
}

function clearErrors() {
  ['title', 'category', 'description', 'date', 'address', 'maxParticipants'].forEach((field) => {
    const input = document.getElementById(field);
    const error = document.getElementById(field + '-error');
    input.classList.remove('is-invalid');
    error.textContent = '';
  });
  document.getElementById('form-error').classList.add('d-none');
}

function showFieldErrors(errors) {
  Object.entries(errors).forEach(([field, message]) => {
    const input = document.getElementById(field);
    const error = document.getElementById(field + '-error');
    if (input && error) {
      input.classList.add('is-invalid');
      error.textContent = message;
    }
  });
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

  document.getElementById('cancel-link').href = '/event/index.html?id=' + encodeURIComponent(eventId);

  const res = await fetch('/api/events/' + encodeURIComponent(eventId));
  if (!res.ok) {
    window.location.href = '/event/index.html?id=' + encodeURIComponent(eventId);
    return;
  }

  const event = await res.json();

  if (!event.isManager) {
    window.location.href = '/event/index.html?id=' + encodeURIComponent(eventId);
    return;
  }

  populateForm(event);

  const originalAddress = event.address || '';
  const addressPicker = wireAddressAutocomplete({
    inputId: 'address',
    suggestionsId: 'address-suggestions',
    confirmedId: 'address-confirmed',
  });

  document.getElementById('edit-event-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const body = {
      title: document.getElementById('title').value.trim(),
      category: document.getElementById('category').value.trim(),
      description: document.getElementById('description').value.trim(),
      date: document.getElementById('date').value,
      maxParticipants: document.getElementById('maxParticipants').value,
    };

    // An unchanged address is left out of the request so the coordinates
    // already stored for it survive.
    const place = addressPicker.getPlace();
    const addressText = addressPicker.getText();
    if (place) {
      body.address = place.address;
      body.latitude = place.latitude;
      body.longitude = place.longitude;
    } else if (!addressText) {
      body.address = '';
    } else if (addressText !== originalAddress) {
      showFieldErrors({ address: 'Select an address from the suggestions.' });
      return;
    }

    const res = await fetch('/api/events/' + encodeURIComponent(eventId), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      if (data.errors) {
        showFieldErrors(data.errors);
      } else {
        const formError = document.getElementById('form-error');
        formError.textContent = data.error || 'Something went wrong.';
        formError.classList.remove('d-none');
      }
      return;
    }

    window.location.href = '/event/index.html?id=' + encodeURIComponent(eventId);
  });
}

init();
