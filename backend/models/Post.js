const mongoose = require('mongoose');

const CONTENT_MAX_LENGTH = 2000;
const COMMENT_MAX_LENGTH = 500;

const commentSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true, trim: true, maxlength: COMMENT_MAX_LENGTH },
  },
  { timestamps: true }
);

const postSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
    content: { type: String, required: true, trim: true, maxlength: CONTENT_MAX_LENGTH },
    postType: { type: String, enum: ['text', 'image'], default: 'text' },
    imageUrl: { type: String, trim: true, default: '' },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    comments: [commentSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Post', postSchema);
