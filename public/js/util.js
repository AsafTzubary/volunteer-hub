// Scoped to 500, not all 5xx: the Places routes answer 502 when Google is
// unhappy, and each caller degrades gracefully from that on its own.
(function guardAgainstServerErrors() {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async function (...args) {
    const response = await originalFetch(...args);
    if (response.status === 500) {
      const requestId = response.headers.get('X-Request-Id');
      window.location.href = requestId
        ? '/500.html?ref=' + encodeURIComponent(requestId)
        : '/500.html';
    }
    return response;
  };
})();

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