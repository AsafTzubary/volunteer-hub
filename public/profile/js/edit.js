async function loadSession() {
  const res = await fetch('/api/auth/me');
  if (!res.ok) {
    window.location.href = '../login.html';
    return null;
  }
  return (await res.json()).username;
}

async function loadProfile(username) {
  const res = await fetch('/api/users/' + encodeURIComponent(username));
  if (!res.ok) {
    window.location.href = '../login.html';
    return null;
  }
  return res.json();
}

function populateForm(profile) {
  document.getElementById('fullName').value = profile.fullName || '';
  document.getElementById('email').value = profile.email || '';
  document.getElementById('city').value = profile.city || '';
  document.getElementById('interests').value = (profile.interests || []).join(', ');
}

function clearErrors() {
  ['fullName', 'email', 'city', 'interests'].forEach((field) => {
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

  document.getElementById('my-profile-link').href =
    'index.html?username=' + encodeURIComponent(sessionUsername);

  document.getElementById('cancel-link').href =
    'index.html?username=' + encodeURIComponent(sessionUsername);

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '../login.html';
  });

  const profile = await loadProfile(sessionUsername);
  if (!profile) return;

  if (!profile.isOwn) {
    window.location.href = 'index.html?username=' + encodeURIComponent(sessionUsername);
    return;
  }

  populateForm(profile);

  document.getElementById('edit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const interestsRaw = document.getElementById('interests').value;
    const interests = interestsRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const body = {
      fullName:  document.getElementById('fullName').value.trim(),
      email:     document.getElementById('email').value.trim(),
      city:      document.getElementById('city').value.trim(),
      interests,
    };

    const res = await fetch('/api/users/me', {
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

    window.location.href = 'index.html?username=' + encodeURIComponent(sessionUsername);
  });
}

init();
