const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Post = require('../models/Post');
const Group = require('../models/Group');
const User = require('../models/User');
const { validatePostContent } = require('../utils/validators');

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

async function listGroupPosts(req, res) {
  const { groupId } = req.query;

  if (!groupId || !mongoose.isValidObjectId(groupId)) {
    return res.status(400).json({ error: 'Valid groupId is required.' });
  }

  const posts = await Post.find({ group: groupId })
    .populate('author', 'username fullName')
    .sort({ createdAt: -1 })
    .lean();

  res.json(
    posts.map((post) => ({
      id: post._id,
      author: post.author,
      content: post.content,
      postType: post.postType,
      imageUrl: post.imageUrl,
      likesCount: post.likes.length,
      commentsCount: post.comments.length,
      createdAt: post.createdAt,
      editedAt: post.editedAt,
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
    likesCount: 0,
    commentsCount: 0,
    createdAt: populated.createdAt,
    editedAt: populated.editedAt,
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

async function updatePost(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(404).json({ error: 'Post not found.' });

  const post = await Post.findById(id).select('author content imageUrl').lean();
  if (!post) return res.status(404).json({ error: 'Post not found.' });

  const user = await User.findOne({ username: req.session.username }).select('_id').lean();
  if (!post.author.equals(user._id)) {
    return res.status(403).json({ error: 'Only the post author can edit this post.' });
  }

  const { content, imageData, removeImage } = req.body;
  const updates = {};

  if (content !== undefined) {
    const contentError = validatePostContent(content);
    if (contentError) return res.status(400).json({ error: contentError });
    if (content.trim() !== post.content) updates.content = content.trim();
  }

  if (removeImage) {
    if (post.imageUrl) {
      updates.postType = 'text';
      updates.imageUrl = '';
    }
  } else if (imageData) {
    const savedPath = saveBase64Image(imageData);
    if (!savedPath) return res.status(400).json({ error: 'Invalid image format.' });
    updates.postType = 'image';
    updates.imageUrl = savedPath;
  }

  // A save that changes nothing should not mark the post as edited.
  const hasChanges = Object.keys(updates).length > 0;
  if (hasChanges) updates.editedAt = new Date();

  const updated = await (hasChanges
    ? Post.findByIdAndUpdate(id, { $set: updates }, { new: true })
    : Post.findById(id))
    .populate('author', 'username fullName')
    .populate('group', 'name')
    .lean();

  res.json(formatPost(updated));
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
    return res.json({ posts: posts.map(formatPost), hasMore: false });
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
  res.json({ posts: page.map(formatPost), hasMore });
}
function formatPost(post) {
  return {
    id: post._id,
    author: post.author,
    group: post.group ? { id: post.group._id, name: post.group.name } : null,
    content: post.content,
    postType: post.postType,
    imageUrl: post.imageUrl,
    likesCount: post.likes ? post.likes.length : 0,
    commentsCount: post.comments ? post.comments.length : 0,
    createdAt: post.createdAt,
    editedAt: post.editedAt || null,
  };
}

module.exports = { listGroupPosts, createPost, updatePost, deletePost, getFeed };
