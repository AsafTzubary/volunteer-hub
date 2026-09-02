const User = require('../models/User');
const {
  validateFullName,
  validateEmail,
  validateCity,
  validateInterests,
} = require('../utils/validators');

const USERS_PAGE_SIZE = 9;

// User search parameters:
//
//   name        - case-insensitive partial match against either the username
//                 or the full name. One box covers both on purpose: people
//                 looking for "dana" rarely know which of the two they are
//                 remembering.
//   city        - case-insensitive partial match against the user's city.
//   interest    - case-insensitive partial match against any one of the
//                 user's interest tags.
//   friendsOnly - when set, only the viewer's own friends.
//   createdFrom - only users who joined on or after this date (ISO string).
//   createdTo   - only users who joined on or before this date (ISO string).
//
// Empty-field behavior: same convention as the group and event searches -
// any omitted or blank param is left out of the query entirely rather than
// excluding results.
//
// Sorting: username ascending by default. A people directory reads best
// alphabetically, unlike groups/events where recency is the natural order;
// `sort=createdAt_desc` gives newest members first.
//
// Note: email is deliberately absent from the response. getProfile only
// reveals it on your own profile, so a directory listing must not become a
// way around that.

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Query params always arrive as strings, so a checkbox-style flag needs an
// explicit check - otherwise `?friendsOnly=false` reads as "yes".
function isFlagSet(value) {
  return value === 'true' || value === '1';
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// `<input type="date">` submits a bare "YYYY-MM-DD", which parses to midnight.
// That is what you want from a lower bound, but as an upper bound it would
// exclude everyone who joined *during* the day the user picked - so "joined
// to: today", or the same day in both boxes, would come back empty. A bare
// date used as an upper bound therefore means the end of that day.
function parseDateBound(value, { endOfDay = false } = {}) {
  const date = new Date(value);
  if (isNaN(date)) return null;
  if (endOfDay && DATE_ONLY.test(String(value).trim())) {
    date.setUTCHours(23, 59, 59, 999);
  }
  return date;
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

  // interests is an array of plain strings, so matching a regex against the
  // field matches when *any* element matches - no $elemMatch needed.
  if (interest && interest.trim()) {
    filter.interests = { $regex: escapeRegex(interest.trim()), $options: 'i' };
  }

  if (isFlagSet(friendsOnly)) {
    filter._id = { $in: viewer.friends || [] };
  }

  if (createdFrom) {
    const fromDate = parseDateBound(createdFrom);
    if (fromDate) filter.createdAt = { ...filter.createdAt, $gte: fromDate };
  }
  if (createdTo) {
    const toDate = parseDateBound(createdTo, { endOfDay: true });
    if (toDate) filter.createdAt = { ...filter.createdAt, $lte: toDate };
  }

  return filter;
}

// Every sort ends in a unique field so that skip/limit paging is stable.
// username is unique on its own; createdAt is not - the seeded accounts share
// a timestamp to the millisecond - and sorting on it alone lets the same user
// appear on two pages while another is skipped entirely.
const USER_SORT_OPTIONS = {
  name_asc: { username: 1 },
  name_desc: { username: -1 },
  createdAt_desc: { createdAt: -1, _id: -1 },
};

function resolveUserSort(sortParam) {
  return USER_SORT_OPTIONS[sortParam] || USER_SORT_OPTIONS.name_asc;
}

async function listUsers(req, res) {
  // The viewer is loaded first because two parts of the response depend on
  // it: the friendsOnly filter, and the per-user isFriend/isSelf flags the
  // directory needs to render the right friend button.
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

  // friends is symmetric (addFriend/removeFriend write both sides), so the
  // viewer's own list is enough to decide isFriend for everyone listed.
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
      isSelf: user._id.equals(viewer._id),
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
