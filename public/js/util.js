const originalFetch = window.fetch.bind(window);

window.fetch = async function (...args) {
  const response = await originalFetch(...args);
  if (response.status >= 500) {
    const params = new URLSearchParams({ status: response.status });
    const requestId = response.headers.get('X-Request-Id');
    if (requestId) params.set('ref', requestId);
    window.location.href = '/500.html?' + params;
  }
  return response;
};

// For callers that recover from an upstream failure on their own instead of
// giving up the whole page.
function fetchWithoutErrorPage(...args) {
  return originalFetch(...args);
}

async function loadSession() {
  const res = await fetch('/api/auth/me');
  if (!res.ok) {
    window.location.href = '/login.html';
    return null;
  }
  return await res.json();
}

function wireLogout() {
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login.html';
  });
}

function profileUrl(username) {
  return '/profile/index.html?username=' + encodeURIComponent(username);
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isAdmin(session) {
  return session && session.role === 'admin';
}
