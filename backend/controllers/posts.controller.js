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

module.exports = { listGroupPosts, createPost, deletePost };
