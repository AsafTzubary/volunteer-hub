function targetGroupId() {
  return new URLSearchParams(window.location.search).get('id');
}

function personRow(person, showRemove, showMakeManager) {
  const name = person.fullName || person.username;
  return `
    <div class="member-avatar">${name[0].toUpperCase()}</div>
    <div>
      <a href="${profileUrl(person.username)}" class="text-decoration-none text-dark fw-semibold small">${name}</a>
      ${person.city ? `<div class="text-muted" style="font-size:0.72rem">${person.city}</div>` : ''}
    </div>
    <div class="d-flex gap-1">
      ${showMakeManager ? `<button class="btn btn-sm btn-outline-primary make-manager-btn" data-username="${person.username}">Make Manager</button>` : ''}
      ${showRemove ? `<button class="btn btn-sm btn-outline-danger remove-member-btn" data-username="${person.username}">Remove</button>` : ''}
    </div>
      `;
}

function renderManager(manager) {
  const container = document.getElementById('manager-info');
  container.className = 'member-item';
  container.innerHTML = personRow(manager);
}

function renderMembers(members, isManager, groupId, managerUsername) {
  const list = document.getElementById('members-list');
  document.getElementById('members-count').textContent = members.length || '';
  if (!members.length) {
    list.innerHTML = '<li class="text-muted small">No members yet.</li>';
    return;
  }
  list.innerHTML = '';
  members.forEach((member) => {
    const li = document.createElement('li');
    li.className = 'member-item';
    const showMakeManager = isManager && member.username !== managerUsername;
    li.innerHTML = personRow(member, isManager, showMakeManager);
    list.appendChild(li);
  });
  list.querySelectorAll('.remove-member-btn').forEach((btn) => {
  btn.addEventListener('click', () => handleRemoveMember(groupId, btn.dataset.username, btn));
  });
  list.querySelectorAll('.make-manager-btn').forEach((btn) => {
    btn.addEventListener('click', () => handleTransferOwnership(groupId, btn.dataset.username));
  });
}

async function handleJoin(groupId) {
  const btn = document.getElementById('join-group-btn');
  btn.disabled = true;
  const res = await fetch('/api/groups/' + encodeURIComponent(groupId) + '/join', { method: 'POST' });
  const data = await res.json();
  if (!res.ok) {
    alert(data.error || 'Failed to join group.');
    btn.disabled = false;
    return;
  }
  btn.classList.add('d-none');
  const leaveBtn = document.getElementById('leave-group-btn');
  leaveBtn.classList.remove('d-none');
  leaveBtn.disabled = false;
  leaveBtn.addEventListener('click', () => handleLeave(groupId));
  await refreshMembers(groupId);
}

async function handleLeave(groupId) {
  const btn = document.getElementById('leave-group-btn');
  btn.disabled = true;
  const res = await fetch('/api/groups/' + encodeURIComponent(groupId) + '/leave', { method: 'POST' });
  const data = await res.json();
  if (!res.ok) {
    alert(data.error || 'Failed to leave group.');
    btn.disabled = false;
    return;
  }
  btn.classList.add('d-none');
  const joinBtn = document.getElementById('join-group-btn');
  joinBtn.classList.remove('d-none');
  joinBtn.disabled = false;
  joinBtn.addEventListener('click', () => handleJoin(groupId));
  await refreshMembers(groupId);
}

let pendingDeleteGroupId = null;
function handleDelete(groupId) {
  pendingDeleteGroupId = groupId;
  bootstrap.Modal.getOrCreateInstance(document.getElementById('delete-group-modal')).show();
}

async function confirmDelete() {
  const confirmBtn = document.getElementById('confirm-delete-btn');
  confirmBtn.disabled = true;
  const res = await fetch('/api/groups/' + encodeURIComponent(pendingDeleteGroupId), { method: 'DELETE' });
  const data = await res.json();
  confirmBtn.disabled = false;
  if (!res.ok) {
    bootstrap.Modal.getInstance(document.getElementById('delete-group-modal')).hide();
    alert(data.error || 'Failed to delete group.');
    return;
  }
  window.location.href = '/group/list.html';
}

let pendingDeletePostId = null;
async function handleDeletePostClick(postId) {
  pendingDeletePostId = postId;
  bootstrap.Modal.getOrCreateInstance(document.getElementById('delete-post-modal')).show();
}

async function confirmDeletePost() {
  const confirmBtn = document.getElementById('confirm-delete-post-btn');
  confirmBtn.disabled = true;
  const res = await fetch('/api/posts/' + encodeURIComponent(pendingDeletePostId), { method: 'DELETE' });
  const data = await res.json();
  confirmBtn.disabled = false;
  if (!res.ok) {
    bootstrap.Modal.getInstance(document.getElementById('delete-post-modal')).hide();
    alert(data.error || 'Failed to delete post.');
    return;
  } else {
    currentPosts = currentPosts.filter((post) => post.id !== pendingDeletePostId);
    document.querySelector('[data-post-id="' + pendingDeletePostId + '"]').remove();
    bootstrap.Modal.getInstance(document.getElementById('delete-post-modal')).hide();
  }
}

let pendingTransfer = null;
function handleTransferOwnership(groupId, username) {
  pendingTransfer = { groupId, username };
  document.getElementById('transfer-target-name').textContent = username;
  bootstrap.Modal.getOrCreateInstance(document.getElementById('transfer-ownership-modal')).show();
}

async function confirmTransfer() {
  const confirmBtn = document.getElementById('confirm-transfer-btn');
  confirmBtn.disabled = true;
  const res = await fetch(
    '/api/groups/' + encodeURIComponent(pendingTransfer.groupId) + '/manager/' + encodeURIComponent(pendingTransfer.username),
    { method: 'POST' }
  );
  const data = await res.json();
  confirmBtn.disabled = false;
  if (!res.ok) {
    bootstrap.Modal.getInstance(document.getElementById('transfer-ownership-modal')).hide();
    alert(data.error || 'Failed to transfer ownership.');
    return;
  }
  window.location.reload();
}

function renderActionButtons(group) {
  if (group.isManager) {
    const editBtn = document.getElementById('edit-group-btn');
    editBtn.href = '/group/edit.html?id=' + encodeURIComponent(group.id);
    editBtn.classList.remove('d-none');
    const createEventBtn = document.getElementById('create-event-btn');
    createEventBtn.href = '/event/create.html?groupId=' + encodeURIComponent(group.id);
    createEventBtn.classList.remove('d-none');
    const deleteBtn = document.getElementById('delete-group-btn');
    deleteBtn.classList.remove('d-none');
    deleteBtn.disabled = false;
    deleteBtn.addEventListener('click', () => handleDelete(group.id));
  } else if (group.isMember) {
    const leaveBtn = document.getElementById('leave-group-btn');
    leaveBtn.classList.remove('d-none');
    leaveBtn.disabled = false;
    leaveBtn.addEventListener('click', () => handleLeave(group.id));
  } else {
    const joinBtn = document.getElementById('join-group-btn');
    joinBtn.classList.remove('d-none');
    joinBtn.disabled = false;
    joinBtn.addEventListener('click', () => handleJoin(group.id));
  }
}

let currentPosts = [];
let postsContext = { sessionUsername: '', isManager: false };

function findPost(postId) {
  return currentPosts.find((post) => post.id === postId);
}

function canEditPost(post) {
  return post.author.username === postsContext.sessionUsername;
}

function canDeletePost(post) {
  return postsContext.isManager || canEditPost(post);
}

function postCard(post, canDelete, canEdit) {
  const authorName = post.author.fullName || post.author.username;
  const date = new Date(post.createdAt).toLocaleDateString();
  const edited = post.editedAt ? ' · edited' : '';
  const media = post.postType === 'image' && post.imageUrl
    ? `<img src="${post.imageUrl}" alt="post image" class="img-fluid rounded mt-2" style="max-height:300px" />`
    : '';
  const actions = canEdit || canDelete
    ? `<div class="d-flex gap-2 mt-2">
        ${canEdit ? `<button class="btn btn-sm btn-outline-secondary edit-post-btn" data-id="${post.id}">Edit</button>` : ''}
        ${canDelete ? `<button class="btn btn-sm btn-outline-danger delete-post-btn" data-id="${post.id}">Delete</button>` : ''}
      </div>`
    : '';
  return `
    <div class="border rounded p-3 mb-3" data-post-id="${post.id}">
      <div class="d-flex justify-content-between align-items-center mb-1">
        <a href="${profileUrl(post.author.username)}" class="fw-semibold text-decoration-none small">${authorName}</a>
        <span class="text-muted" style="font-size:0.72rem">${date}${edited}</span>
      </div>
      <p class="mb-0 small">${post.content}</p>
      ${media}
      ${actions}
    </div>
  `;
}

function postEditForm(post) {
  const currentImage = post.postType === 'image' && post.imageUrl
    ? `
      <img src="${post.imageUrl}" alt="post image" class="img-fluid rounded mb-2" style="max-height:180px" />
      <div class="form-check mb-2">
        <input class="form-check-input edit-post-remove-image" type="checkbox" id="remove-image-${post.id}" />
        <label class="form-check-label small" for="remove-image-${post.id}">Remove this image</label>
      </div>`
    : '';
  return `
    <form class="post-edit-form">
      <div class="mb-2">
        <textarea class="form-control form-control-sm edit-post-content" rows="3" maxlength="2000" required>${post.content}</textarea>
      </div>
      ${currentImage}
      <div class="mb-2">
        <input type="file" accept="image/*" class="form-control form-control-sm edit-post-image" />
      </div>
      <p class="edit-post-error text-danger small mb-2 d-none"></p>
      <div class="d-flex gap-2">
        <button type="submit" class="btn btn-primary btn-sm">Save</button>
        <button type="button" class="btn btn-outline-secondary btn-sm cancel-edit-btn">Cancel</button>
      </div>
    </form>
  `;
}

function postCardEl(postId) {
  return document.querySelector('[data-post-id="' + postId + '"]');
}

function renderPostCard(post) {
  return postCard(post, canDeletePost(post), canEditPost(post));
}

function showPostCard(post) {
  postCardEl(post.id).outerHTML = renderPostCard(post);
  wirePostCard(postCardEl(post.id));
}

function wirePostCard(card) {
  const editBtn = card.querySelector('.edit-post-btn');
  if (editBtn) editBtn.addEventListener('click', () => startEditPost(editBtn.dataset.id));
  const deleteBtn = card.querySelector('.delete-post-btn');
  if (deleteBtn) deleteBtn.addEventListener('click', () => handleDeletePostClick(deleteBtn.dataset.id));
}

function startEditPost(postId) {
  const post = findPost(postId);
  const card = postCardEl(postId);
  card.innerHTML = postEditForm(post);
  card.querySelector('.cancel-edit-btn').addEventListener('click', () => showPostCard(post));
  card.querySelector('.post-edit-form').addEventListener('submit', function (e) {
    e.preventDefault();
    saveEditPost(post, card);
  });
}

async function saveEditPost(post, card) {
  const errorEl = card.querySelector('.edit-post-error');
  errorEl.classList.add('d-none');

  const removeImageInput = card.querySelector('.edit-post-remove-image');
  const removeImage = removeImageInput ? removeImageInput.checked : false;
  const file = card.querySelector('.edit-post-image').files[0];
  const body = {
    content: card.querySelector('.edit-post-content').value,
    imageData: file && !removeImage ? await readFileAsBase64(file) : null,
    removeImage,
  };

  const buttons = card.querySelectorAll('.post-edit-form button');
  buttons.forEach((btn) => (btn.disabled = true));
  const res = await fetch('/api/posts/' + encodeURIComponent(post.id), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  buttons.forEach((btn) => (btn.disabled = false));

  if (!res.ok) {
    errorEl.textContent = data.error || 'Failed to update post.';
    errorEl.classList.remove('d-none');
    return;
  }

  Object.assign(post, data);
  showPostCard(post);
}

function renderPosts(posts) {
  currentPosts = posts;
  const list = document.getElementById('posts-list');
  if (!posts.length) {
    list.innerHTML = '<p class="text-muted small mb-0">No posts yet.</p>';
    return;
  }
  list.innerHTML = posts.map((post) => renderPostCard(post)).join('');
  list.querySelectorAll('[data-post-id]').forEach((card) => wirePostCard(card));
}

async function loadPosts(groupId, sessionUsername, isManager) {
  postsContext = { sessionUsername, isManager };
  const res = await fetch('/api/posts?groupId=' + encodeURIComponent(groupId));
  if (!res.ok) return;
  const posts = await res.json();
  renderPosts(posts);
}

function formatEventDate(iso) {
  return new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

const RSVP_OPTIONS = [
  { value: 'going', label: 'Going' },
  { value: 'interested', label: 'Interested' },
  { value: 'not_going', label: 'Not Going' },
];

function participantsText(event) {
  return `${event.participantsCount}/${event.maxParticipants} participants`;
}

function rsvpCountsText(event) {
  return `${event.interestedCount} interested, ${event.notGoingCount} not going`;
}

function rsvpButtons(event) {
  const isFull = event.participantsCount >= event.maxParticipants && event.myStatus !== 'going';
  return RSVP_OPTIONS.map((option) => {
    const style = option.value === event.myStatus ? 'btn-primary' : 'btn-outline-primary';
    const disabled = option.value === 'going' && isFull ? ' disabled' : '';
    return `<button type="button" class="btn btn-sm ${style} rsvp-btn" data-status="${option.value}"${disabled}>${option.label}</button>`;
  }).join('');
}

function eventCard(event, canRsvp, canDelete) {
  const managerName = event.manager.fullName || event.manager.username;
  return `
    <div class="border rounded p-3" data-event-id="${event.id}">
      <div class="d-flex justify-content-between align-items-center mb-1">
        <span class="fw-semibold small">${event.title}</span>
        <span class="category-badge">${event.category}</span>
      </div>
      <p class="text-muted small mb-1">${formatEventDate(event.date)}</p>
      ${event.address ? `<p class="text-muted small mb-1">${event.address}</p>` : ''}
      ${event.description ? `<p class="mb-1 small">${event.description}</p>` : ''}
      <p class="text-muted small mb-0">
        <span class="participants-count">${participantsText(event)}</span> · Organized by ${managerName}
      </p>
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mt-2">
        <div class="btn-group">${canRsvp ? rsvpButtons(event) : ''}</div>
        <span class="rsvp-counts text-muted" style="font-size:0.72rem">${rsvpCountsText(event)}</span>
      </div>
      ${canDelete ? `<button class="btn btn-sm btn-outline-danger delete-event-btn mt-2" data-id="${event.id}">Cancel Event</button>` : ''}
    </div>
  `;
}

function refreshRsvpState(card, event) {
  const isFull = event.participantsCount >= event.maxParticipants && event.myStatus !== 'going';
  card.querySelectorAll('.rsvp-btn').forEach((btn) => {
    const isActive = btn.dataset.status === event.myStatus;
    btn.classList.toggle('btn-primary', isActive);
    btn.classList.toggle('btn-outline-primary', !isActive);
    btn.disabled = btn.dataset.status === 'going' && isFull;
  });
  card.querySelector('.participants-count').textContent = participantsText(event);
  card.querySelector('.rsvp-counts').textContent = rsvpCountsText(event);
}

async function handleRsvpClick(card, btn) {
  // Clicking the active option clears the response.
  const status = btn.classList.contains('btn-primary') ? null : btn.dataset.status;
  const buttons = card.querySelectorAll('.rsvp-btn');
  buttons.forEach((b) => (b.disabled = true));

  const res = await fetch('/api/events/' + encodeURIComponent(card.dataset.eventId) + '/rsvp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  const data = await res.json();
  buttons.forEach((b) => (b.disabled = false));

  if (!res.ok) {
    alert(data.error || 'Failed to update your response.');
    return;
  }

  Object.assign(currentEvents[currentEventIndex], data);
  refreshRsvpState(card, data);
}

let currentEvents = [];
let currentEventIndex = 0;
let eventsContext = null;
let pendingDeleteEventId = null;

function renderCurrentEvent() {
  const list = document.getElementById('events-list');
  const nav = document.getElementById('events-nav');

  if (!currentEvents.length) {
    list.innerHTML = '<p class="text-muted small mb-0">No events scheduled yet.</p>';
    nav.classList.remove('d-flex');
    nav.classList.add('d-none');
    return;
  }

  const event = currentEvents[currentEventIndex];
  list.innerHTML = eventCard(event, eventsContext.canRsvp, eventsContext.isManager);
  wireEventCard(list);

  document.getElementById('event-indicator').textContent =
    `Event ${currentEventIndex + 1} of ${currentEvents.length}`;
  document.getElementById('prev-event-btn').disabled = currentEventIndex === 0;
  document.getElementById('next-event-btn').disabled = currentEventIndex === currentEvents.length - 1;

  nav.classList.remove('d-none');
  nav.classList.add('d-flex');
}

function wireEventCard(list) {
  const card = list.querySelector('[data-event-id]');
  if (!card) return;
  card.querySelectorAll('.rsvp-btn').forEach((btn) => {
    btn.addEventListener('click', () => handleRsvpClick(card, btn));
  });
  const deleteBtn = card.querySelector('.delete-event-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => handleDeleteEventClick(deleteBtn.dataset.id));
  }
}

function handleDeleteEventClick(eventId) {
  pendingDeleteEventId = eventId;
  bootstrap.Modal.getOrCreateInstance(document.getElementById('delete-event-modal')).show();
}

async function confirmDeleteEvent() {
  const confirmBtn = document.getElementById('confirm-delete-event-btn');
  confirmBtn.disabled = true;
  const res = await fetch('/api/events/' + encodeURIComponent(pendingDeleteEventId), { method: 'DELETE' });
  const data = await res.json();
  confirmBtn.disabled = false;
  bootstrap.Modal.getInstance(document.getElementById('delete-event-modal')).hide();
  if (!res.ok) {
    alert(data.error || 'Failed to cancel event.');
    return;
  }
  currentEvents = currentEvents.filter((event) => event.id !== pendingDeleteEventId);
  if (currentEventIndex >= currentEvents.length) {
    currentEventIndex = Math.max(0, currentEvents.length - 1);
  }
  renderCurrentEvent();
}

async function loadEvents(group) {
  eventsContext = { isManager: group.isManager, canRsvp: group.isManager || group.isMember };
  const res = await fetch('/api/events?groupId=' + encodeURIComponent(group.id));
  if (!res.ok) return;
  currentEvents = await res.json();
  currentEventIndex = 0;
  renderCurrentEvent();
}

function readFileAsBase64(file) {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();
    reader.onload = function () { resolve(reader.result); };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function wirePostForm(groupId) {
  document.getElementById('post-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    const errorEl = document.getElementById('post-error');
    errorEl.classList.add('d-none');
    const content = document.getElementById('post-content').value;
    const fileInput = document.getElementById('post-image');
    const file = fileInput.files[0];
    let imageData = null;
    if (file) {
      imageData = await readFileAsBase64(file);
    }
    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId, content, imageData }),
    });
    const data = await res.json();
    if (!res.ok) {
      errorEl.textContent = data.error || 'Failed to create post.';
      errorEl.classList.remove('d-none');
      return;
    }
    const list = document.getElementById('posts-list');
    const placeholder = list.querySelector('p.text-muted');
    if (placeholder) placeholder.remove();
    currentPosts.unshift(data);
    list.insertAdjacentHTML('afterbegin', renderPostCard(data));
    wirePostCard(list.firstElementChild);
    this.reset();
  });
}

function renderGroup(group) {
  document.getElementById('group-name').textContent = group.name;
  document.getElementById('group-category').textContent = group.category;
  document.getElementById('group-description').textContent =
    group.description || 'No description provided.';
  renderManager(group.manager);
  renderMembers(group.members, group.isManager, group.id, group.manager.username);
  renderActionButtons(group);
  if (group.isMember || group.isManager) {
    document.getElementById('post-form').classList.remove('d-none');
  }
}

async function refreshMembers(groupId) {
  const res = await fetch('/api/groups/' + encodeURIComponent(groupId));
  if (!res.ok) return;
  const group = await res.json();
  renderManager(group.manager);
  renderMembers(group.members, group.isManager, group.id, group.manager.username);
}

async function init() {
  const session = await loadSession();
  if (!session) return;
  const sessionUsername = session.username;
  document.getElementById('my-profile-link').href = profileUrl(sessionUsername);
  wireLogout();
  document.getElementById('confirm-delete-btn').addEventListener('click', confirmDelete);
  document.getElementById('confirm-delete-post-btn').addEventListener('click', confirmDeletePost);
  document.getElementById('confirm-transfer-btn').addEventListener('click', confirmTransfer);
  document.getElementById('confirm-delete-event-btn').addEventListener('click', confirmDeleteEvent);
  document.getElementById('prev-event-btn').addEventListener('click', () => {
    if (currentEventIndex > 0) {
      currentEventIndex -= 1;
      renderCurrentEvent();
    }
  });
  document.getElementById('next-event-btn').addEventListener('click', () => {
    if (currentEventIndex < currentEvents.length - 1) {
      currentEventIndex += 1;
      renderCurrentEvent();
    }
  });
  const groupId = targetGroupId();
  if (!groupId) {
    document.getElementById('not-found').classList.remove('d-none');
    return;
  }
  const res = await fetch('/api/groups/' + encodeURIComponent(groupId));
  if (!res.ok) {
    document.getElementById('not-found').classList.remove('d-none');
    return;
  }
  const group = await res.json();
  document.title = `${group.name} — Volunteer Hub`;
  document.getElementById('group-content').classList.remove('d-none');
  renderGroup(group);
  wirePostForm(groupId);
  loadPosts(groupId, sessionUsername, group.isManager);
  loadEvents(group);
}

async function handleRemoveMember(groupId, username, btn){
  btn.disabled = true;
  const res = await fetch('/api/groups/' + encodeURIComponent(groupId) + '/members/' + encodeURIComponent(username), { method: 'DELETE' });
  const data = await res.json();
  if (!res.ok) {
    alert(data.error || 'Failed to remove member from.');
    btn.disabled = false;
    return;
  } else {
    btn.closest('li').remove()
    document.getElementById('members-count').textContent = document.getElementById('members-list').children.length || '';
  }
}

init();
