const form = document.getElementById('login-form');
const errorMessage = document.getElementById('error-message');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorMessage.classList.add('d-none');

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      errorMessage.textContent = data.error || 'Login failed.';
      errorMessage.classList.remove('d-none');
      return;
    }

    window.location.href = 'dashboard.html';
  } catch (err) {
    errorMessage.textContent = 'Could not reach the server. Please try again.';
    errorMessage.classList.remove('d-none');
  }
});
