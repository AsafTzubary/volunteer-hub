const mongoose = require('mongoose');
const { USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH, USERNAME_REGEX } = require('../utils/validators');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: USERNAME_MIN_LENGTH,
      maxlength: USERNAME_MAX_LENGTH,
      match: USERNAME_REGEX,
    },
    passwordHash:  { type: String, required: true },
    fullName:      { type: String, trim: true, default: '' },
    email:         { type: String, trim: true, lowercase: true, default: '' },
    city:          { type: String, trim: true, default: '' },
    interests:     [{ type: String, trim: true }],
    friends:       [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    joinedGroups:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }],
    role:          { type: String, enum: ['user', 'admin'], default: 'user' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
