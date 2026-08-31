const User = require('../models/User');
const {
  validateFullName,
  validateEmail,
  validateCity,
  validateInterests,
} = require('../utils/validators');

const USERS_PAGE_SIZE = 9;

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isFlagSet(value) {
  return value === 'true' || value === '1';
}

function buildUserSearchFilter(query, viewer) {
  const { name, city, interest, friendsOnly, createdFrom, createdTo } = query;
  const filter = {};

  if (name && name.trim()) {
    const pattern = { $regex: escapeRegex(name.trim()), $options: 'i' };
    filter.$or = [{ username: pattern }, { fullName: pattern }];
  }

  if (city && city.trim()) {
    filter.city = { $regex: escapeRegex(city.trim()), $options: 'i' };
  }

  if (interest && interest.trim()) {
    filter.interests = { $regex: escapeRegex(interest.trim()), $options: 'i' };
  }

  if (isFlagSet(friendsOnly)) {
    filter._id = { $in: viewer.friends || [] };
  }

  if (createdFrom) {
    const fromDate = new Date(createdFrom);
    if (!isNaN(fromDate)) {
      filter.createdAt = { ...filter.createdAt, $gte: fromDate };
    }
  }
  if (createdTo) {
    const toDate = new Date(createdTo);
    if (!isNaN(toDate)) {
      toDate.setHours(23, 59, 59, 999);
      filter.createdAt = { ...filter.createdAt, $lte: toDate };
    }
  }

  return filter;
}

const USER_SORT_OPTIONS = {
  name_asc: { username: 1 },
  name_desc: { username: -1 },
  createdAt_desc: { createdAt: -1 },
};

function resolveUserSort(sortParam) {
  return USER_SORT_OPTIONS[sortParam] || USER_SORT_OPTIONS.name_asc;
}

async function listUsers(req, res) {
  const viewer = await User.findOne({ username: req.session.username })
    .select('friends')
    .lean();
  if (!viewer) return res.status(401).json({ error: 'Not authenticated.' });

  const filter = buildUserSearchFilter(req.query, viewer);
  const sort = resolveUserSort(req.query.sort);
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const skip = (page - 1) * USERS_PAGE_SIZE;

  const [users, totalCount] = await Promise.all([
    User.find(filter)
      .select('username fullName city interests friends joinedGroups createdAt')
      .sort(sort)
      .skip(skip)
      .limit(USERS_PAGE_SIZE)
      .lean(),
    User.countDocuments(filter),
  ]);

  const friendIds = new Set((viewer.friends || []).map((id) => id.toString()));

  res.json({
    users: users.map((user) => ({
      username: user.username,
      fullName: user.fullName,
      city: user.city,
      interests: user.interests || [],
      friendCount: (user.friends || []).length,
      groupCount: (user.joinedGroups || []).length,
      createdAt: user.createdAt,
      isFriend: friendIds.has(user._id.toString()),
      isSelf: user._id.toString() === viewer._id.toString(),
    })),
    page,
    totalPages: Math.max(1, Math.ceil(totalCount / USERS_PAGE_SIZE)),
    totalCount,
  });
}

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

module.exports = { listUsers, getProfile, updateProfile, addFriend, removeFriend };
