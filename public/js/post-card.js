function postCard(post) {
  const authorName = post.author.fullName || post.author.username;
  const date = new Date(post.createdAt).toLocaleDateString();
  const groupBadge = post.group
    ? `<a href="/group/index.html?id=${encodeURIComponent(post.group.id)}" class="text-muted text-decoration-none small ms-2">${post.group.name}</a>`
    : '';
  const media = post.postType === 'image' && post.imageUrl
    ? `<img src="${post.imageUrl}" alt="post image" class="img-fluid rounded mt-2" style="max-height:300px" />`
    : '';
  return `
    <div class="border rounded p-3 mb-3">
      <div class="d-flex justify-content-between align-items-center mb-1">
        <div>
          <a href="${profileUrl(post.author.username)}" class="fw-semibold text-decoration-none small">${authorName}</a>
          ${groupBadge}
        </div>
        <span class="text-muted" style="font-size:0.72rem">${date}</span>
      </div>
      <p class="mb-0 small">${post.content}</p>
      ${media}
    </div>
  `;
}
