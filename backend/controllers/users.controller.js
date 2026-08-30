const User = require('../models/User');
const {
  validateFullName,
  validateEmail,
  validateCity,
  validateInterests,
} = require('../utils/validators');

async function getProfile(req, res) {
  const { username } = req.params;
  const viewerUsername = req.session.username;

  const user = await User.findOne({ username })
    .populate('friends', 'username fullName city')
    .populate('joinedGroups', 'name category')
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
    const fullNameError = validateFullName(fullName);
    if (fullNameError) errors.fullName = fullNameError;
  }

  if (email !== undefined) {
    const emailError = validateEmail(email);
    if (emailError) errors.email = emailError;
  }

  if (city !== undefined) {
    const cityError = validateCity(city);
    if (cityError) errors.city = cityError;
  }

  if (interests !== undefined) {
    const interestsError = validateInterests(interests);
    if (interestsError) errors.interests = interestsError;
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


async function addFriend(req, res) {
  const { username } = req.params;

  const friend = await User.findOne({ username });
  if (!friend) {
    return res.status(404).json({ error: 'Username not found.' });
  }

  if (req.session.username === username) {
    return res.status(400).json({ error: "Can't friend yourself." });
  }

  const me = await User.findOne({ username: req.session.username });

  await User.findOneAndUpdate(
    { username: req.session.username },
    { $addToSet: { friends: friend._id } }
  );

  await User.findOneAndUpdate(
    { username: username },
    { $addToSet: { friends: me._id } }
  );

  res.json({ ok: true });

}

async function removeFriend(req, res) {
  const { username } = req.params;

  const friend = await User.findOne({ username });
  if (!friend) {
    return res.status(404).json({ error: 'Username not found.' });
  }

  const me = await User.findOne({ username: req.session.username });

  await User.findOneAndUpdate(
    { username: req.session.username },
    { $pull: { friends: friend._id } }
  );

  await User.findOneAndUpdate(
    { username: username },
    { $pull: { friends: me._id } }
  );

  res.json({ ok: true });

}

module.exports = { getProfile, updateProfile, addFriend, removeFriend };
