const MARKER_COLORS = {
  upcoming: '#0d6efd',
  full: '#6c757d',
};

const FALLBACK_CENTER = { lat: 39.5, lng: -98.35 };
const MAX_INITIAL_ZOOM = 14;
const SELECTED_ZOOM = 12;

let map = null;
let infoWindow = null;
let activeEventId = null;
const markersByEventId = new Map();

function formatEventDate(iso) {
  return new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

// Coordinates are optional: an address typed without picking a suggestion
// is saved as text with no lat/lng.
function hasLocation(event) {
  return typeof event.latitude === 'number' && typeof event.longitude === 'number';
}

function eventCard(event) {
  const managerName = event.manager.fullName || event.manager.username;
  const eventUrl = `/event/index.html?id=${encodeURIComponent(event.id)}`;
  const locatable = hasLocation(event);
  const location = locatable
    ? event.address
    : `${event.address || 'No address given'} - not shown on map`;
  return `
    <div class="card shadow-sm p-3 event-card${locatable ? '' : ' no-location'}" data-event-id="${event.id}">
      <div class="d-flex justify-content-between align-items-start mb-1">
        <a href="${eventUrl}" class="fw-semibold small text-decoration-none">${event.title}</a>
        <span class="category-badge ms-2">${event.category}</span>
      </div>
      <p class="text-muted small mb-1">${formatEventDate(event.date)}</p>
      <p class="text-muted small mb-1">${location}</p>
      <p class="text-muted small mb-0">${event.group.name} · ${event.participantsCount}/${event.maxParticipants} participants · ${managerName}</p>
    </div>
  `;
}

function infoWindowContent(event) {
  return `
    <div class="map-info-window">
      <div class="fw-semibold small mb-1">${event.title}</div>
      <div class="text-muted small mb-1">${formatEventDate(event.date)}</div>
      <div class="text-muted small mb-1">${event.address}</div>
      <div class="text-muted small mb-2">${event.group.name} · ${event.participantsCount}/${event.maxParticipants} participants${event.status === 'full' ? ' · Full' : ''}</div>
      <a href="/event/index.html?id=${encodeURIComponent(event.id)}" class="small">View event</a>
    </div>
  `;
}

function markerIcon(status, emphasized) {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    fillColor: MARKER_COLORS[status] || MARKER_COLORS.upcoming,
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: emphasized ? 4 : 2,
    scale: emphasized ? 11 : 8,
  };
}

function showMapMessage(text) {
  const messageEl = document.getElementById('map-message');
  messageEl.querySelector('span').textContent = text;
  messageEl.classList.remove('d-none');
}

function hideMapMessage() {
  document.getElementById('map-message').classList.add('d-none');
}

function cardFor(eventId) {
  return document.querySelector(`.event-card[data-event-id="${eventId}"]`);
}

// Passing null clears the selection.
function setActiveEvent(eventId) {
  const previous = markersByEventId.get(activeEventId);
  if (previous) {
    previous.marker.setIcon(markerIcon(previous.event.status, false));
    previous.marker.setZIndex(1);
  }
  const previousCard = cardFor(activeEventId);
  if (previousCard) previousCard.classList.remove('is-active');

  activeEventId = eventId;
  if (!eventId) {
    infoWindow.close();
    return;
  }

  const card = cardFor(eventId);
  if (card) card.classList.add('is-active');

  const entry = markersByEventId.get(eventId);
  if (!entry) return;

  entry.marker.setIcon(markerIcon(entry.event.status, true));
  entry.marker.setZIndex(1000);
  infoWindow.setContent(infoWindowContent(entry.event));
  infoWindow.open({ map, anchor: entry.marker });
}

function selectFromCard(eventId) {
  const entry = markersByEventId.get(eventId);
  if (!entry) return;
  setActiveEvent(eventId);
  map.panTo(entry.marker.getPosition());
  if (map.getZoom() < SELECTED_ZOOM) map.setZoom(SELECTED_ZOOM);
}

function selectFromMarker(eventId) {
  setActiveEvent(eventId);
  const card = cardFor(eventId);
  if (card) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function setHovered(eventId, hovered) {
  const entry = markersByEventId.get(eventId);
  if (!entry || eventId === activeEventId) return;
  entry.marker.setIcon(markerIcon(entry.event.status, hovered));
  entry.marker.setZIndex(hovered ? 500 : 1);
}

function wireEventCards() {
  document.querySelectorAll('.event-card').forEach((card) => {
    const { eventId } = card.dataset;
    card.addEventListener('click', (e) => {
      // Let the "View event" link navigate instead of selecting the marker.
      if (e.target.closest('a')) return;
      selectFromCard(eventId);
    });
    card.addEventListener('mouseenter', () => setHovered(eventId, true));
    card.addEventListener('mouseleave', () => setHovered(eventId, false));
  });
}

function renderMap(events) {
  map = new google.maps.Map(document.getElementById('map'), {
    center: FALLBACK_CENTER,
    zoom: 4,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
  });

  infoWindow = new google.maps.InfoWindow();
  infoWindow.addListener('closeclick', () => setActiveEvent(null));

  const bounds = new google.maps.LatLngBounds();
  events.filter(hasLocation).forEach((event) => {
    const position = { lat: event.latitude, lng: event.longitude };
    const marker = new google.maps.Marker({
      map,
      position,
      title: event.title,
      icon: markerIcon(event.status, false),
      zIndex: 1,
    });
    marker.addListener('click', () => selectFromMarker(event.id));
    markersByEventId.set(event.id, { marker, event });
    bounds.extend(position);
  });

  map.fitBounds(bounds, 48);
  // fitBounds zooms all the way in for a single marker, so cap it once settled.
  google.maps.event.addListenerOnce(map, 'idle', () => {
    if (map.getZoom() > MAX_INITIAL_ZOOM) map.setZoom(MAX_INITIAL_ZOOM);
  });
}

async function loadMapsApi() {
  const res = await fetch('/api/places/maps-key');
  if (!res.ok) throw new Error('Map unavailable - could not load the map configuration.');

  const { key } = await res.json();
  if (!key) throw new Error('Map unavailable - no Google Maps API key is configured.');

  return new Promise((resolve, reject) => {
    // A bad key is rejected only after the script loads and calls back, so this
    // reports the failure directly rather than rejecting the promise.
    window.gm_authFailure = () => {
      showMapMessage('Map unavailable - the Google Maps API key was rejected. Check the key and that the Maps JavaScript API is enabled for it.');
    };
    window.initGoogleMap = resolve;

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=initGoogleMap&loading=async`;
    script.async = true;
    script.onerror = () => reject(new Error('Map unavailable - could not reach Google Maps.'));
    document.head.appendChild(script);
  });
}

async function init() {
  const sessionUsername = await loadSession();
  if (!sessionUsername) return;

  document.getElementById('my-profile-link').href = profileUrl(sessionUsername);
  wireLogout();

  const res = await fetch('/api/events/all');
  const list = document.getElementById('events-list');

  if (!res.ok) {
    list.innerHTML = '<p class="text-muted small">Failed to load events.</p>';
    showMapMessage('Map unavailable - events could not be loaded.');
    return;
  }

  const events = await res.json();
  list.innerHTML = events.length
    ? events.map(eventCard).join('')
    : '<p class="text-muted small">No upcoming events.</p>';
  wireEventCards();

  const locatableCount = events.filter(hasLocation).length;
  document.getElementById('events-summary').textContent = events.length
    ? `${events.length} upcoming event${events.length === 1 ? '' : 's'} · ${locatableCount} on the map`
    : '';

  if (!locatableCount) {
    showMapMessage(
      events.length
        ? 'None of the upcoming events have a location yet.'
        : 'No upcoming events to show.'
    );
    return;
  }

  try {
    await loadMapsApi();
  } catch (err) {
    showMapMessage(err.message);
    return;
  }

  renderMap(events);
  hideMapMessage();
}

init();
