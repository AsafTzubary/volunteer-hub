const mongoose = require('mongoose');
const { USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH, USERNAME_REGEX } = require('../utils/validators');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: USERNAME_MIN_LENGTH,
    maxlength: USERNAME_MAX_LENGTH,
    match: USERNAME_REGEX,
  },
  passwordHash: { type: String, required: true },
});

module.exports = mongoose.model('User', userSchema);
