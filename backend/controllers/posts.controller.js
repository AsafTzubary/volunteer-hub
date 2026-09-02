const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Post = require('../models/Post');
const Group = require('../models/Group');
const User = require('../models/User');
const { validatePostContent, validateCommentContent } = require('../utils/validators');

const UPLOADS_DIR = path.join(__dirname, '../../public/uploads');

const MIME_TO_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

function saveBase64Image(dataUri) {
  const match = dataUri.match(/^data:([a-zA-Z0-9+/]+\/[a-zA-Z0-9+/]+);base64,(.+)$/);
  if (!match) return null;

  const mime = match[1];
  const ext = MIME_TO_EXT[mime];
  if (!ext) return null;

  const filename = Date.now() + '-' + Math.random().toString(36).slice(2) + '.' + ext;
  const buffer = Buffer.from(match[2], 'base64');
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);
  return '/uploads/' + filename;
}

// Who is allowed to like or comment on a post. This deliberately mirrors the
// visibility rule getFeed() uses (a group you joined OR a post by a friend) so
// that a post showing up in your feed is always one you can actually react to
// - otherwise a friend's post from a group you never joined would render with
// a like button that always 403s.
function canInteract(group, viewer, authorId) {
  if (!viewer) return false;
  if (group) {
    if (group.manager.equals(viewer._id)) return true;
    if (group.members.some((member) => member.equals(viewer._id))) return true;
  }
  if (!authorId) return false;
  if (authorId.equals(viewer._id)) return true;
  return (viewer.friends || []).some((friend) => friend.equals(authorId));
}

// The like/comment fields every post payload carries, so the client can render
// the buttons in their current state without a second round trip.
function engagement(post, viewer, interactive) {
  const likes = post.likes || [];
  return {
    likesCount: likes.length,
    commentsCount: (post.comments || []).length,
    likedByMe: Boolean(viewer && likes.some((like) => like.equals(viewer._id))),
    canInteract: interactive,
  };
}

function canDeleteComment(comment, post, group, viewer) {
  if (!viewer) return false;
  const authorId = comment.author && comment.author._id ? comment.author._id : comment.author;
  return (
    authorId.equals(viewer._id) ||
    post.author.equals(viewer._id) ||
    Boolean(group && group.manager.equals(viewer._id))
  );
}

function formatComment(comment, post, group, viewer) {
  return {
    id: comment._id,
    author: comment.author,
    content: comment.content,
    createdAt: comment.createdAt,
    canDelete: canDeleteComment(comment, post, group, viewer),
  };
}

// Every single-post action (like, comment, delete comment) needs the same
// three documents, so they all load them through here.
async function loadPostContext(postId, username, options) {
  const withComments = Boolean(options && options.withComments);
  let query = Post.findById(postId).select('author group likes comments');
  if (withComments) query = query.populate('comments.author', 'username fullName');

  const post = await query.lean();
  if (!post) return null;

  const [group, viewer] = await Promise.all([
    Group.findById(post.group).select('manager members').lean(),
    User.findOne({ username }).select('_id friends').lean(),
  ]);

  return { post, group, viewer };
}

async function listGroupPosts(req, res) {
  const { groupId } = req.query;

  if (!groupId || !mongoose.isValidObjectId(groupId)) {
    return res.status(400).json({ error: 'Valid groupId is required.' });
  }

  const [posts, group, viewer] = await Promise.all([
    Post.find({ group: groupId })
      .populate('author', 'username fullName')
      .sort({ createdAt: -1 })
      .lean(),
    Group.findById(groupId).select('manager members').lean(),
    User.findOne({ username: req.session.username }).select('_id friends').lean(),
  ]);

  res.json(
    posts.map((post) => ({
      id: post._id,
      author: post.author,
      content: post.content,
      postType: post.postType,
      imageUrl: post.imageUrl,
      createdAt: post.createdAt,
      ...engagement(post, viewer, canInteract(group, viewer, post.author && post.author._id)),
    }))
  );
}

async function createPost(req, res) {
  const { groupId, content, imageData } = req.body;

  if (!groupId || !mongoose.isValidObjectId(groupId)) {
    return res.status(400).json({ error: 'Valid groupId is required.' });
  }

  const contentError = validatePostContent(content);
  if (contentError) return res.status(400).json({ error: contentError });

  const [group, user] = await Promise.all([
    Group.findById(groupId).select('manager members').lean(),
    User.findOne({ username: req.session.username }).select('_id').lean(),
  ]);

  if (!group) return res.status(404).json({ error: 'Group not found.' });

  const isManager = group.manager.equals(user._id);
  const isMember = group.members.some((m) => m.equals(user._id));

  if (!isManager && !isMember) {
    return res.status(403).json({ error: 'Only group members can post.' });
  }

  let postType = 'text';
  let imageUrl = '';

  if (imageData) {
    const savedPath = saveBase64Image(imageData);
    if (!savedPath) return res.status(400).json({ error: 'Invalid image format.' });
    postType = 'image';
    imageUrl = savedPath;
  }

  const post = await Post.create({
    author: user._id,
    group: groupId,
    content: content.trim(),
    postType,
    imageUrl,
  });

  const populated = await Post.findById(post._id)
    .populate('author', 'username fullName')
    .lean();

  res.status(201).json({
    id: populated._id,
    author: populated.author,
    content: populated.content,
    postType: populated.postType,
    imageUrl: populated.imageUrl,
    createdAt: populated.createdAt,
    likesCount: 0,
    commentsCount: 0,
    likedByMe: false,
    canInteract: true,
  });
}
async function deletePost(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(404).json({ error: 'Post not found.' });
  const post = await Post.findById(id).select('author group').lean();
  if (!post) return res.status(404).json({ error: 'Post not found.' });
  const [group, user] = await Promise.all([
    Group.findById(post.group).select('manager').lean(),
    User.findOne({ username: req.session.username }).select('_id').lean(),
  ]);
  const isAuthor = post.author.equals(user._id);
  const isManager = group.manager.equals(user._id);
  if (!isAuthor && !isManager) {
    return res.status(403).json({ error: 'Only the post author or group manager can delete this post.' });
  }
  await Post.deleteOne({ _id: id });
  return res.status(200).json({ message: 'Post deleted successfully' });
}

// Likes are a plain array of user ids, so toggling is a $pull or an $addToSet
// rather than a read-modify-write of the whole array - two rapid clicks (or two
// open tabs) can't end up pushing the same user twice.
async function toggleLike(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(404).json({ error: 'Post not found.' });

  const context = await loadPostContext(id, req.session.username);
  if (!context) return res.status(404).json({ error: 'Post not found.' });

  const { post, group, viewer } = context;
  if (!canInteract(group, viewer, post.author)) {
    return res.status(403).json({ error: 'Only group members can like this post.' });
  }

  const alreadyLiked = post.likes.some((like) => like.equals(viewer._id));
  await Post.updateOne(
    { _id: id },
    alreadyLiked ? { $pull: { likes: viewer._id } } : { $addToSet: { likes: viewer._id } }
  );

  const updated = await Post.findById(id).select('likes').lean();
  res.json({ id, likesCount: updated.likes.length, likedByMe: !alreadyLiked });
}

// Comments are readable by anyone signed in, matching listGroupPosts - someone
// browsing a group page they haven't joined can read the discussion, they just
// can't join it (canInteract gates that).
async function listComments(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(404).json({ error: 'Post not found.' });

  const context = await loadPostContext(id, req.session.username, { withComments: true });
  if (!context) return res.status(404).json({ error: 'Post not found.' });

  const { post, group, viewer } = context;
  res.json({
    commentsCount: post.comments.length,
    canInteract: canInteract(group, viewer, post.author),
    comments: post.comments.map((comment) => formatComment(comment, post, group, viewer)),
  });
}

async function addComment(req, res) {
  const { id } = req.params;
  const { content } = req.body;
  if (!mongoose.isValidObjectId(id)) return res.status(404).json({ error: 'Post not found.' });

  const contentError = validateCommentContent(content);
  if (contentError) return res.status(400).json({ error: contentError });

  const context = await loadPostContext(id, req.session.username);
  if (!context) return res.status(404).json({ error: 'Post not found.' });

  const { post, group, viewer } = context;
  if (!canInteract(group, viewer, post.author)) {
    return res.status(403).json({ error: 'Only group members can comment on this post.' });
  }

  await Post.updateOne(
    { _id: id },
    { $push: { comments: { author: viewer._id, content: content.trim() } } }
  );

  const updated = await Post.findById(id)
    .select('comments')
    .populate('comments.author', 'username fullName')
    .lean();
  const created = updated.comments[updated.comments.length - 1];

  res.status(201).json({
    commentsCount: updated.comments.length,
    comment: formatComment(created, post, group, viewer),
  });
}

async function deleteComment(req, res) {
  const { id, commentId } = req.params;
  if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(commentId)) {
    return res.status(404).json({ error: 'Comment not found.' });
  }

  const context = await loadPostContext(id, req.session.username);
  if (!context) return res.status(404).json({ error: 'Comment not found.' });

  const { post, group, viewer } = context;
  const comment = post.comments.find((item) => item._id.equals(commentId));
  if (!comment) return res.status(404).json({ error: 'Comment not found.' });

  if (!canDeleteComment(comment, post, group, viewer)) {
    return res.status(403).json({
      error: 'Only the comment author, the post author or the group manager can delete this comment.',
    });
  }

  await Post.updateOne({ _id: id }, { $pull: { comments: { _id: comment._id } } });

  const updated = await Post.findById(id).select('comments').lean();
  res.json({ message: 'Comment deleted successfully', commentsCount: updated.comments.length });
}

const FEED_PAGE_SIZE = 10;
async function getFeed(req, res) {
  const { before, after } = req.query;
  const user = await User.findOne({ username: req.session.username })
    .select('joinedGroups friends')
    .lean();
  const baseFilter = {
    $or: [
      { group: { $in: user.joinedGroups } },
      { author: { $in: user.friends } },
    ],
  };
  if (after) {
    const afterDate = new Date(after);
    if (isNaN(afterDate)) return res.status(400).json({ error: 'Invalid after date.' });
    const posts = await Post.find({ ...baseFilter, createdAt: { $gt: afterDate } })
      .populate('author', 'username fullName')
      .populate('group', 'name')
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ posts: posts.map((post) => formatPost(post, user)), hasMore: false });
  }
  const filter = before
    ? { ...baseFilter, createdAt: { $lt: new Date(before) } }
    : baseFilter;
  if (before && isNaN(new Date(before))) {
    return res.status(400).json({ error: 'Invalid before date.' });
  }
  const posts = await Post.find(filter)
    .populate('author', 'username fullName')
    .populate('group', 'name')
    .sort({ createdAt: -1 })
    .limit(FEED_PAGE_SIZE + 1)
    .lean();
  const hasMore = posts.length > FEED_PAGE_SIZE;
  const page = posts.slice(0, FEED_PAGE_SIZE);
  res.json({ posts: page.map((post) => formatPost(post, user)), hasMore });
}
function formatPost(post, viewer) {
  return {
    id: post._id,
    author: post.author,
    group: post.group ? { id: post.group._id, name: post.group.name } : null,
    content: post.content,
    postType: post.postType,
    imageUrl: post.imageUrl,
    createdAt: post.createdAt,
    // Everything the feed query returns is either from a group the viewer
    // joined or from a friend, which is exactly the canInteract rule.
    ...engagement(post, viewer, true),
  };
}

module.exports = {
  listGroupPosts,
  createPost,
  deletePost,
  getFeed,
  toggleLike,
  listComments,
  addComment,
  deleteComment,
};
