const mongoose = require('mongoose');
const Group = require('../models/Group');
const User = require('../models/User');
const Post = require('../models/Post');
const Event = require('../models/Event');
const {
  validateGroupName,
  validateCategory,
  validateGroupDescription,
} = require('../utils/validators');

const GROUPS_PAGE_SIZE = 9;

// Group search parameters (task 70):
//
//   name        - case-insensitive partial match against the group's name.
//   category    - exact match against the group's category.
//   minMembers  - only groups with at least this many members.
//   maxMembers  - only groups with at most this many members.
//   createdFrom - only groups created on or after this date (ISO string).
//   createdTo   - only groups created on or before this date (ISO string).
//
// Empty-field behavior: any of the above that is omitted or an empty string
// is left out of the query entirely rather than treated as "match nothing" -
// same convention already used by updateEvent (`if (x !== undefined) ...`).
//
// Sorting: results are sorted by createdAt descending (newest first) by
// default, matching the existing unfiltered listGroups behavior. No other
// sort options are exposed yet.
//
// Note: the Group model has no "city" field, so city is not a valid filter
// despite being mentioned in an earlier draft of this task.

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Builds the Mongo filter for listGroups from whichever search params were
// actually provided. Anything omitted or blank is left out of the query
// entirely (see the task 70 doc comment above) rather than excluding results.
function buildGroupSearchFilter(query) {
  const { name, category, minMembers, maxMembers, createdFrom, createdTo } = query;
  const filter = {};

  if (name && name.trim()) {
    filter.name = { $regex: escapeRegex(name.trim()), $options: 'i' };
  }

  if (category && category.trim()) {
    filter.category = category.trim();
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
      filter.createdAt = { ...filter.createdAt, $lte: toDate };
    }
  }

  // members is an array field, so "member count" isn't a plain field match -
  // $expr + $size lets us compare its length like a computed number.
  const memberCountConditions = [];
  if (minMembers !== undefined && minMembers !== '' && !isNaN(Number(minMembers))) {
    memberCountConditions.push({ $gte: [{ $size: '$members' }, Number(minMembers)] });
  }
  if (maxMembers !== undefined && maxMembers !== '' && !isNaN(Number(maxMembers))) {
    memberCountConditions.push({ $lte: [{ $size: '$members' }, Number(maxMembers)] });
  }
  if (memberCountConditions.length === 1) {
    filter.$expr = memberCountConditions[0];
  } else if (memberCountConditions.length > 1) {
    filter.$expr = { $and: memberCountConditions };
  }

  return filter;
}

async function listGroups(req, res) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const skip = (page - 1) * GROUPS_PAGE_SIZE;
  const filter = buildGroupSearchFilter(req.query);

  const [groups, totalCount] = await Promise.all([
    Group.find(filter)
      .select('name category manager members createdAt')
      .populate('manager', 'username fullName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(GROUPS_PAGE_SIZE)
      .lean(),
    Group.countDocuments(filter),
  ]);

  res.json({
    groups: groups.map((group) => ({
      id: group._id,
      name: group.name,
      category: group.category,
      manager: group.manager,
      memberCount: group.members.length,
    })),
    page,
    totalPages: Math.max(1, Math.ceil(totalCount / GROUPS_PAGE_SIZE)),
    totalCount,
  });
}

async function getGroupDetails(req, res) {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(404).json({ error: 'Group not found.' });
  }

  const group = await Group.findById(id)
    .populate('manager', 'username fullName city')
    .populate('members', 'username fullName city')
    .lean();

  if (!group) {
    return res.status(404).json({ error: 'Group not found.' });
  }

  const viewerUsername = req.session.username;
  const isManager = group.manager?.username === viewerUsername;
  const isMember = group.members.some((member) => member.username === viewerUsername);

  res.json({
    id: group._id,
    name: group.name,
    description: group.description,
    category: group.category,
    manager: group.manager,
    members: group.members,
    memberCount: group.members.length,
    createdAt: group.createdAt,
    isManager,
    isMember,
  });
}

async function getManagedGroup(req, res) {
  const manager = await User.findOne({ username: req.session.username }).select('_id').lean();
  const group = await Group.findOne({ manager: manager._id }).select('_id').lean();

  if (!group) {
    return res.status(404).json({ error: 'No managed group found.' });
  }

  res.json({ id: group._id });
}

async function createGroup(req, res) {
  const { name, category, description = '' } = req.body;

  const nameError = validateGroupName(name);
  if (nameError) return res.status(400).json({ error: nameError });

  const categoryError = validateCategory(category);
  if (categoryError) return res.status(400).json({ error: categoryError });

  const descriptionError = validateGroupDescription(description);
  if (descriptionError) return res.status(400).json({ error: descriptionError });

  const manager = await User.findOne({ username: req.session.username }).select('_id').lean();

  const existingGroup = await Group.findOne({ manager: manager._id }).select('_id').lean();
  if (existingGroup) {
    return res.status(409).json({
      error: 'You already manage a group.',
      groupId: existingGroup._id,
    });
  }

  const group = await Group.create({
    name: name.trim(),
    category: category.trim(),
    description: description.trim(),
    manager: manager._id,
    members: [manager._id],
  });

  await User.updateOne({ _id: manager._id }, { $addToSet: { joinedGroups: group._id } });

  res.status(201).json({ id: group._id });
}

async function updateGroup(req, res) {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(404).json({ error: 'Group not found.' });
  }

  const group = await Group.findById(id).select('manager').lean();
  if (!group) {
    return res.status(404).json({ error: 'Group not found.' });
  }

  const user = await User.findOne({ username: req.session.username }).select('_id').lean();
  if (!group.manager.equals(user._id)) {
    return res.status(403).json({ error: 'Only the group manager can edit this group.' });
  }

  const { name, category, description } = req.body;
  const errors = {};

  if (name !== undefined) {
    const nameError = validateGroupName(name);
    if (nameError) errors.name = nameError;
  }

  if (category !== undefined) {
    const categoryError = validateCategory(category);
    if (categoryError) errors.category = categoryError;
  }

  if (description !== undefined) {
    const descriptionError = validateGroupDescription(description);
    if (descriptionError) errors.description = descriptionError;
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ errors });
  }

  const updates = {};
  if (name !== undefined) updates.name = name.trim();
  if (category !== undefined) updates.category = category.trim();
  if (description !== undefined) updates.description = description.trim();

  const updatedGroup = await Group.findByIdAndUpdate(id, { $set: updates }, { new: true, lean: true });

  res.json({
    id: updatedGroup._id,
    name: updatedGroup.name,
    category: updatedGroup.category,
    description: updatedGroup.description,
  });
}

async function deleteGroup(req, res) {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(404).json({ error: 'Group not found.' });
  }

  const group = await Group.findById(id).select('manager').lean();
  if (!group) {
    return res.status(404).json({ error: 'Group not found.' });
  }

  const user = await User.findOne({ username: req.session.username }).select('_id').lean();
  if (!group.manager.equals(user._id)) {
    return res.status(403).json({ error: 'Only the group manager can delete this group.' });
  }

  await Promise.all([
    Group.deleteOne({ _id: id }),
    Post.deleteMany({ group: id }),
    Event.deleteMany({ group: id }),
    User.updateMany({ joinedGroups: id }, { $pull: { joinedGroups: id } }),
  ]);

  res.json({ message: 'Group deleted successfully.' });
}

async function joinGroup(req, res) {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(404).json({ error: 'Group not found.' });
  }

  const [group, user] = await Promise.all([
    Group.findById(id).select('members').lean(),
    User.findOne({ username: req.session.username }).select('_id joinedGroups').lean(),
  ]);

  if (!group) return res.status(404).json({ error: 'Group not found.' });

  const alreadyMember = group.members.some((m) => m.equals(user._id));
  if (alreadyMember) return res.status(409).json({ error: 'You are already a member of this group.' });

  await Promise.all([
    Group.updateOne({ _id: id }, { $addToSet: { members: user._id } }),
    User.updateOne({ _id: user._id }, { $addToSet: { joinedGroups: id } }),
  ]);

  res.json({ message: 'Joined group successfully.' });
}

async function leaveGroup(req, res) {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(404).json({ error: 'Group not found.' });
  }

  const [group, user] = await Promise.all([
    Group.findById(id).select('members manager').lean(),
    User.findOne({ username: req.session.username }).select('_id').lean(),
  ]);

  if (!group) return res.status(404).json({ error: 'Group not found.' });

  if (group.manager.equals(user._id)) {
    return res.status(403).json({ error: 'Managers cannot leave their group. Transfer ownership first.' });
  }

  const isMember = group.members.some((m) => m.equals(user._id));
  if (!isMember) return res.status(409).json({ error: 'You are not a member of this group.' });

  await Promise.all([
    Group.updateOne({ _id: id }, { $pull: { members: user._id } }),
    User.updateOne({ _id: user._id }, { $pull: { joinedGroups: id } }),
  ]);

  res.json({ message: 'Left group successfully.' });
}

async function removeMember(req, res) {
  const { id, username } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(404).json({ error: 'Group not found.' });
  }
  const requester = await User.findOne({ username: req.session.username }).select('_id').lean();
  const group = await Group.findById(id).select('members manager').lean();
  const target = await User.findOne({ username }).select('_id').lean();

  if (!group) {
    return res.status(404).json({ error: 'Group not found.' });
  }
  if (!target) {
    return res.status(404).json({ error: 'Username not found.' });
  }
  if (!group.manager.equals(requester._id)) {
    return res.status(403).json({ error: 'Only managers can remove members.' });
  }
  if (group.manager.equals(target._id)){
    return res.status(403).json({ error: 'Can not remove group manager.' });
  }
  const isMember = group.members.some((m) => m.equals(target._id));
  if (!isMember) return res.status(409).json({ error: 'Target user is not a member of the group.' });
  await Promise.all([
    Group.updateOne({ _id: id }, { $pull: { members: target._id } }),
    User.updateOne({ _id: target._id }, { $pull: { joinedGroups: id } }),
  ]);
  res.json({ message: 'Removed from group successfully.' });
}

async function transferOwnership(req, res) {
  const { id, username } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(404).json({ error: 'Group not found.' });
  }

  const [requester, group, target] = await Promise.all([
    User.findOne({ username: req.session.username }).select('_id').lean(),
    Group.findById(id).select('manager members').lean(),
    User.findOne({ username }).select('_id').lean(),
  ]);

  if (!group) {
    return res.status(404).json({ error: 'Group not found.' });
  }
  if (!target) {
    return res.status(404).json({ error: 'Username not found.' });
  }
  if (!group.manager.equals(requester._id)) {
    return res.status(403).json({ error: 'Only the current manager can transfer ownership.' });
  }
  if (group.manager.equals(target._id)) {
    return res.status(400).json({ error: 'This user is already the manager.' });
  }

  const isMember = group.members.some((m) => m.equals(target._id));
  if (!isMember) {
    return res.status(409).json({ error: 'The new manager must already be a member of the group.' });
  }

  await Group.updateOne(
    { _id: id },
    { $set: { manager: target._id }, $addToSet: { members: target._id } }
  );

  res.json({ message: 'Ownership transferred successfully.' });
}

module.exports = {
  listGroups,
  getGroupDetails,
  getManagedGroup,
  createGroup,
  updateGroup,
  deleteGroup,
  joinGroup,
  leaveGroup,
  removeMember,
  transferOwnership,
};