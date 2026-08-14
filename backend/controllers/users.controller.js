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

module.exports = { getProfile };
