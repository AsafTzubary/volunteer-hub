function targetGroupId() {
  return new URLSearchParams(window.location.search).get('id');
}

function populateForm(group) {
  document.getElementById('name').value = group.name || '';
  document.getElementById('category').value = group.category || '';
  document.getElementById('description').value = group.description || '';
  document.getElementById('address').value = group.address || '';
  document.getElementById('latitude').value = group.latitude ?? '';
  document.getElementById('longitude').value = group.longitude ?? '';
}

function clearErrors() {
  ['name', 'category', 'description', 'address', 'latitude', 'longitude'].forEach((field) => {
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

  const groupId = targetGroupId();
  if (!groupId) {
    window.location.href = '/group/list.html';
    return;
  }

  document.getElementById('cancel-link').href = '/group/index.html?id=' + encodeURIComponent(groupId);

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

  populateForm(group);

  document.getElementById('edit-group-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const latitude = document.getElementById('latitude').value;
    const longitude = document.getElementById('longitude').value;

    const body = {
      name: document.getElementById('name').value.trim(),
      category: document.getElementById('category').value.trim(),
      description: document.getElementById('description').value.trim(),
      address: document.getElementById('address').value.trim(),
      ...(latitude !== '' && { latitude: Number(latitude) }),
      ...(longitude !== '' && { longitude: Number(longitude) }),
    };

    const res = await fetch('/api/groups/' + encodeURIComponent(groupId), {
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

    window.location.href = '/group/index.html?id=' + encodeURIComponent(groupId);
  });
}

init();