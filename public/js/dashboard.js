let newestPostDate = null;
let oldestPostDate = null;

function renderJoinedGroups(groups) {
  const list = document.getElementById('joined-groups-list');
  if (!groups.length) {
    list.innerHTML = '<li class="text-muted small">You haven\'t joined any groups yet.</li>';
    return;
  }
  list.innerHTML = groups.map((group) => `
    <li class="mb-1">
      <a href="/group/index.html?id=${encodeURIComponent(group._id)}" class="text-decoration-none small">${group.name}</a>
    </li>
  `).join('');
}

function appendPosts(posts) {
  const container = document.getElementById('feed-container');
  posts.forEach((post) => {
    container.insertAdjacentHTML('beforeend', postCard(post));
  });
}

function prependPosts(posts) {
  const container = document.getElementById('feed-container');
  posts.forEach((post) => {
    container.insertAdjacentHTML('afterbegin', postCard(post));
  });
}

async function loadFeed() {
  const res = await fetch('/api/posts/feed');
  if (!res.ok) return;
  const data = await res.json();

  const container = document.getElementById('feed-container');

  if (!data.posts.length) return;

  document.getElementById('feed-empty').remove();
  appendPosts(data.posts);

  newestPostDate = data.posts[0].createdAt;
  oldestPostDate = data.posts[data.posts.length - 1].createdAt;

  const loadMoreBtn = document.getElementById('load-more-btn');
  if (data.hasMore) {
    loadMoreBtn.classList.remove('d-none');
  }
}

async function loadMore() {
  if (!oldestPostDate) return;

  const btn = document.getElementById('load-more-btn');
  btn.disabled = true;

  const res = await fetch('/api/posts/feed?before=' + encodeURIComponent(oldestPostDate));
  if (!res.ok) {
    btn.disabled = false;
    return;
  }

  const data = await res.json();
  if (data.posts.length) {
    appendPosts(data.posts);
    oldestPostDate = data.posts[data.posts.length - 1].createdAt;
  }

  if (data.hasMore) {
    btn.disabled = false;
  } else {
    btn.classList.add('d-none');
  }
}

async function pollNewPosts() {
  if (!newestPostDate) return;

  const res = await fetch('/api/posts/feed?after=' + encodeURIComponent(newestPostDate));
  if (!res.ok) return;
  const data = await res.json();

  if (data.posts.length) {
    const wasEmpty = !document.getElementById('feed-empty') === false;
    if (wasEmpty) document.getElementById('feed-empty').remove();
    prependPosts(data.posts);
    newestPostDate = data.posts[0].createdAt;
  }
}

async function init() {
  const sessionUsername = await loadSession();
  if (!sessionUsername) return;

  const profileUrl_ = profileUrl(sessionUsername);
  document.getElementById('my-profile-link').href = profileUrl_;
  document.getElementById('profile-link').href = profileUrl_;
  wireLogout();

  const res = await fetch('/api/users/' + encodeURIComponent(sessionUsername));
  if (!res.ok) return;
  const user = await res.json();

  const displayName = user.fullName || user.username;
  document.getElementById('profile-avatar').textContent = displayName[0].toUpperCase();
  document.getElementById('profile-name').textContent = displayName;
  document.getElementById('profile-city').textContent = user.city || '';

  renderJoinedGroups(user.joinedGroups || []);

  document.getElementById('load-more-btn').addEventListener('click', loadMore);

  await loadFeed();

  setInterval(pollNewPosts, 15000);
}

init();
