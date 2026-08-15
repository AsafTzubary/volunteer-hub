const User = require('../models/User');

async function getProfile(req, res) {
  const { username } = req.params;
  const viewerUsername = req.session.username;

  const user = await User.findOne({ username })
    .populate('friends', 'username fullName city')
    .lean();

  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  const isOwn = viewerUsername === username;

  const profile = {
    username:     user.username,
    fullName:     user.fullName,
    city:         user.city,
    interests:    user.interests,
    friends:      user.friends,
    joinedGroups: user.joinedGroups,
    role:         user.role,
    createdAt:    user.createdAt,
    isOwn,
  };

  if (isOwn) profile.email = user.email;

  res.json(profile);
}

async function updateProfile(req, res) {
  const { fullName, email, city, interests } = req.body;
  const errors = {};

  if (fullName !== undefined) {
    if (typeof fullName !== 'string' || fullName.trim().length > 60) {
      errors.fullName = 'Full name must be 60 characters or fewer.';
    }
  }

  if (email !== undefined) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (typeof email !== 'string' || (email.trim() !== '' && !emailRegex.test(email.trim()))) {
      errors.email = 'Invalid email address.';
    }
  }

  if (city !== undefined) {
    if (typeof city !== 'string' || city.trim().length > 60) {
      errors.city = 'City must be 60 characters or fewer.';
    }
  }

  if (interests !== undefined) {
    if (!Array.isArray(interests) || interests.length > 10 || interests.some(i => typeof i !== 'string' || i.trim().length > 30)) {
      errors.interests = 'Interests must be up to 10 tags, each 30 characters or fewer.';
    }
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ errors });
  }

  const updates = {};
  if (fullName !== undefined)  updates.fullName  = fullName.trim();
  if (email !== undefined)     updates.email     = email.trim();
  if (city !== undefined)      updates.city      = city.trim();
  if (interests !== undefined) updates.interests = interests.map(i => i.trim()).filter(Boolean);

  const user = await User.findOneAndUpdate(
    { username: req.session.username },
    { $set: updates },
    { new: true, lean: true }
  );

  res.json({
    username:  user.username,
    fullName:  user.fullName,
    email:     user.email,
    city:      user.city,
    interests: user.interests,
  });
}

module.exports = { getProfile, updateProfile };
