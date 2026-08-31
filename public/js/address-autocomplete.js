const SUGGESTION_DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

// Google Places address picker shared by the event create and edit forms.
// Coordinates only come from a picked suggestion, so getPlace() either returns
// an address together with its coordinates or nothing at all.
function wireAddressAutocomplete({ inputId, suggestionsId, confirmedId }) {
  const input = document.getElementById(inputId);
  const suggestionsList = document.getElementById(suggestionsId);
  const confirmedEl = document.getElementById(confirmedId);

  let place = null;
  let debounceTimer = null;

  function hideSuggestions() {
    suggestionsList.classList.add('d-none');
    suggestionsList.innerHTML = '';
  }

  async function selectSuggestion(suggestion) {
    hideSuggestions();
    input.value = suggestion.description;

    const res = await fetch('/api/places/details?placeId=' + encodeURIComponent(suggestion.placeId));
    if (!res.ok) return;

    const detail = await res.json();
    place = {
      address: detail.address,
      latitude: detail.latitude,
      longitude: detail.longitude,
    };
    confirmedEl.textContent = '✓ ' + detail.address;
    confirmedEl.classList.remove('d-none');
  }

  async function search(query) {
    const res = await fetch('/api/places/autocomplete?q=' + encodeURIComponent(query));
    if (!res.ok) return;

    const { suggestions } = await res.json();
    if (!suggestions.length) {
      hideSuggestions();
      return;
    }

    suggestionsList.innerHTML = '';
    suggestions.forEach((suggestion) => {
      const item = document.createElement('li');
      item.className = 'list-group-item list-group-item-action small';
      item.textContent = suggestion.description;
      item.addEventListener('click', () => selectSuggestion(suggestion));
      suggestionsList.appendChild(item);
    });
    suggestionsList.classList.remove('d-none');
  }

  input.addEventListener('input', function () {
    clearTimeout(debounceTimer);
    place = null;
    confirmedEl.classList.add('d-none');

    const query = this.value.trim();
    if (query.length < MIN_QUERY_LENGTH) {
      hideSuggestions();
      return;
    }

    debounceTimer = setTimeout(() => search(query), SUGGESTION_DEBOUNCE_MS);
  });

  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !suggestionsList.contains(e.target)) {
      hideSuggestions();
    }
  });

  return {
    getPlace: () => place,
    getText: () => input.value.trim(),
  };
}
