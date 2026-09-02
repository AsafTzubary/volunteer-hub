// Shared post card, used by both the dashboard feed and the group page.
//
// Likes and comments are wired through a single delegated listener per
// container (see wirePostInteractions) rather than per card, so posts added
// later - a new post, a page of "load more", a poll result - are interactive
// straight away without re-binding anything. Every action is a fetch that
// patches the affected card in place; nothing here reloads the page.

const COMMENT_MAX_LENGTH = 500;

function postDate(iso) {
  return new Date(iso).toLocaleDateString();
}

function likeButton(post) {
  const liked = Boolean(post.likedByMe);
  return `
    <button type="button" class="btn btn-sm like-btn ${liked ? 'btn-primary' : 'btn-outline-primary'}"
      ${post.canInteract === false ? 'disabled' : ''}>
      <span aria-hidden="true">&#9829;</span>
      <span class="like-label">${liked ? 'Liked' : 'Like'}</span>
      <span class="like-count">${post.likesCount || 0}</span>
    </button>
  `;
}

function commentForm() {
  return `
    <form class="comment-form d-flex gap-2 mt-2">
      <input type="text" class="form-control form-control-sm comment-input"
        maxlength="${COMMENT_MAX_LENGTH}" placeholder="Write a comment..." required />
      <button type="submit" class="btn btn-sm btn-primary">Send</button>
    </form>
  `;
}

function postCard(post, options) {
  const opts = options || {};
  const authorName = post.author.fullName || post.author.username;
  const groupBadge = post.group
    ? `<a href="/group/index.html?id=${encodeURIComponent(post.group.id)}" class="text-muted text-decoration-none small ms-2">${escapeHtml(post.group.name)}</a>`
    : '';
  const media = post.postType === 'image' && post.imageUrl
    ? `<img src="${post.imageUrl}" alt="post image" class="img-fluid rounded mt-2" style="max-height:300px" />`
    : '';
  return `
    <div class="border rounded p-3 mb-3 post-card" data-post-id="${post.id}">
      <div class="d-flex justify-content-between align-items-center mb-1">
        <div>
          <a href="${profileUrl(post.author.username)}" class="fw-semibold text-decoration-none small">${escapeHtml(authorName)}</a>
          ${groupBadge}
        </div>
        <span class="text-muted" style="font-size:0.72rem">${postDate(post.createdAt)}</span>
      </div>
      <p class="mb-0 small">${escapeHtml(post.content)}</p>
      ${media}
      <div class="d-flex align-items-center gap-2 mt-2 pt-2 border-top">
        ${likeButton(post)}
        <button type="button" class="btn btn-sm btn-outline-secondary comments-toggle-btn">
          Comments <span class="comment-count">${post.commentsCount || 0}</span>
        </button>
        ${opts.canDelete ? `<button type="button" class="btn btn-sm btn-outline-danger delete-post-btn ms-auto" data-id="${post.id}">Delete</button>` : ''}
      </div>
      <p class="post-feedback text-danger small mb-0 mt-1 d-none"></p>
      <div class="comments-section d-none mt-2">
        <div class="comments-list"></div>
        ${post.canInteract === false ? '' : commentForm()}
      </div>
    </div>
  `;
}

function commentRow(comment) {
  const name = comment.author.fullName || comment.author.username;
  return `
    <div class="comment-item d-flex justify-content-between align-items-start gap-2" data-comment-id="${comment.id}">
      <div class="small">
        <a href="${profileUrl(comment.author.username)}" class="fw-semibold text-decoration-none">${escapeHtml(name)}</a>
        <span class="text-muted ms-1" style="font-size:0.7rem">${postDate(comment.createdAt)}</span>
        <div>${escapeHtml(comment.content)}</div>
      </div>
      ${comment.canDelete ? '<button type="button" class="btn btn-sm btn-link text-danger p-0 delete-comment-btn">Remove</button>' : ''}
    </div>
  `;
}

const NO_COMMENTS_MARKUP = '<p class="text-muted small mb-0 no-comments">No comments yet.</p>';

function showPostFeedback(card, message) {
  const feedback = card.querySelector('.post-feedback');
  feedback.textContent = message;
  feedback.classList.remove('d-none');
}

function clearPostFeedback(card) {
  card.querySelector('.post-feedback').classList.add('d-none');
}

function setCommentCount(card, count) {
  card.querySelector('.comment-count').textContent = count;
}

function applyLikeState(card, data) {
  const btn = card.querySelector('.like-btn');
  btn.classList.toggle('btn-primary', data.likedByMe);
  btn.classList.toggle('btn-outline-primary', !data.likedByMe);
  btn.querySelector('.like-label').textContent = data.likedByMe ? 'Liked' : 'Like';
  card.querySelector('.like-count').textContent = data.likesCount;
}

async function handleLikeClick(card, btn) {
  btn.disabled = true;
  const res = await fetch('/api/posts/' + encodeURIComponent(card.dataset.postId) + '/like', {
    method: 'POST',
  });
  const data = await res.json();
  btn.disabled = false;
  if (!res.ok) {
    showPostFeedback(card, data.error || 'Failed to update your like.');
    return;
  }
  clearPostFeedback(card);
  applyLikeState(card, data);
}

function renderComments(card, comments) {
  const list = card.querySelector('.comments-list');
  list.innerHTML = comments.length ? comments.map(commentRow).join('') : NO_COMMENTS_MARKUP;
}

async function loadComments(card) {
  const section = card.querySelector('.comments-section');
  const list = card.querySelector('.comments-list');
  list.innerHTML = '<p class="text-muted small mb-0">Loading comments...</p>';

  const res = await fetch('/api/posts/' + encodeURIComponent(card.dataset.postId) + '/comments');
  if (!res.ok) {
    list.innerHTML = '<p class="text-danger small mb-0">Failed to load comments.</p>';
    return;
  }

  const data = await res.json();
  section.dataset.loaded = 'true';
  renderComments(card, data.comments);
  setCommentCount(card, data.commentsCount);
}

async function handleToggleComments(card) {
  const section = card.querySelector('.comments-section');
  const wasHidden = section.classList.contains('d-none');
  section.classList.toggle('d-none', !wasHidden);
  if (wasHidden && section.dataset.loaded !== 'true') {
    await loadComments(card);
  }
}

function appendComment(card, comment) {
  const list = card.querySelector('.comments-list');
  const placeholder = list.querySelector('.no-comments');
  if (placeholder) placeholder.remove();
  list.insertAdjacentHTML('beforeend', commentRow(comment));
}

async function handleCommentSubmit(card, form) {
  const input = form.querySelector('.comment-input');
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  const res = await fetch('/api/posts/' + encodeURIComponent(card.dataset.postId) + '/comments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: input.value }),
  });
  const data = await res.json();
  submitBtn.disabled = false;

  if (!res.ok) {
    showPostFeedback(card, data.error || 'Failed to add your comment.');
    return;
  }

  clearPostFeedback(card);
  input.value = '';
  setCommentCount(card, data.commentsCount);

  // If the earlier list fetch failed we have nothing to append to, so pull the
  // whole thread instead of leaving the new comment invisible.
  const section = card.querySelector('.comments-section');
  if (section.dataset.loaded === 'true') {
    appendComment(card, data.comment);
  } else {
    await loadComments(card);
  }
}

async function handleDeleteComment(card, btn) {
  const row = btn.closest('[data-comment-id]');
  btn.disabled = true;

  const url = '/api/posts/' + encodeURIComponent(card.dataset.postId) +
    '/comments/' + encodeURIComponent(row.dataset.commentId);
  const res = await fetch(url, { method: 'DELETE' });
  const data = await res.json();

  if (!res.ok) {
    btn.disabled = false;
    showPostFeedback(card, data.error || 'Failed to delete the comment.');
    return;
  }

  clearPostFeedback(card);
  row.remove();
  setCommentCount(card, data.commentsCount);
  const list = card.querySelector('.comments-list');
  if (!list.querySelector('[data-comment-id]')) list.innerHTML = NO_COMMENTS_MARKUP;
}

// One listener per container, so cards rendered later are wired for free.
// options.onDeletePost lets each page keep its own delete flow (the group page
// routes it through a confirmation modal; the dashboard has none).
function wirePostInteractions(container, options) {
  if (container.dataset.postsWired === 'true') return;
  container.dataset.postsWired = 'true';
  const opts = options || {};

  container.addEventListener('click', (event) => {
    const card = event.target.closest('[data-post-id]');
    if (!card) return;

    const likeBtn = event.target.closest('.like-btn');
    if (likeBtn) return handleLikeClick(card, likeBtn);

    if (event.target.closest('.comments-toggle-btn')) return handleToggleComments(card);

    const deleteCommentBtn = event.target.closest('.delete-comment-btn');
    if (deleteCommentBtn) return handleDeleteComment(card, deleteCommentBtn);

    const deletePostBtn = event.target.closest('.delete-post-btn');
    if (deletePostBtn && opts.onDeletePost) return opts.onDeletePost(deletePostBtn.dataset.id);
  });

  container.addEventListener('submit', (event) => {
    const form = event.target.closest('.comment-form');
    if (!form) return;
    event.preventDefault();
    handleCommentSubmit(form.closest('[data-post-id]'), form);
  });
}
