const mongoose = require('mongoose');
const Group = require('../models/Group');
const User = require('../models/User');
const Post = require('../models/Post');
const {
  validateGroupName,
  validateCategory,
  validateGroupDescription,
  validateAddress,
  validateLatitude,
  validateLongitude,
} = require('../utils/validators');

const GROUPS_PAGE_SIZE = 9;

async function listGroups(req, res) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const skip = (page - 1) * GROUPS_PAGE_SIZE;

  const [groups, totalCount] = await Promise.all([
    Group.find({})
      .select('name category address manager members createdAt')
      .populate('manager', 'username fullName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(GROUPS_PAGE_SIZE)
      .lean(),
    Group.countDocuments({}),
  ]);

  res.json({
    groups: groups.map((group) => ({
      id: group._id,
      name: group.name,
      category: group.category,
      address: group.address,
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
    address: group.address,
    latitude: group.latitude,
    longitude: group.longitude,
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
  const { name, category, description = '', address = '', latitude, longitude } = req.body;

  const nameError = validateGroupName(name);
  if (nameError) return res.status(400).json({ error: nameError });

  const categoryError = validateCategory(category);
  if (categoryError) return res.status(400).json({ error: categoryError });

  const descriptionError = validateGroupDescription(description);
  if (descriptionError) return res.status(400).json({ error: descriptionError });

  const addressError = validateAddress(address);
  if (addressError) return res.status(400).json({ error: addressError });

  if (latitude !== undefined) {
    const latitudeError = validateLatitude(latitude);
    if (latitudeError) return res.status(400).json({ error: latitudeError });
  }

  if (longitude !== undefined) {
    const longitudeError = validateLongitude(longitude);
    if (longitudeError) return res.status(400).json({ error: longitudeError });
  }

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
    address: address.trim(),
    ...(latitude !== undefined && { latitude: Number(latitude) }),
    ...(longitude !== undefined && { longitude: Number(longitude) }),
    manager: manager._id,
    members: [manager._id],
  });

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

  const { name, category, description, address, latitude, longitude } = req.body;
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

  if (address !== undefined) {
    const addressError = validateAddress(address);
    if (addressError) errors.address = addressError;
  }

  if (latitude !== undefined) {
    const latitudeError = validateLatitude(latitude);
    if (latitudeError) errors.latitude = latitudeError;
  }

  if (longitude !== undefined) {
    const longitudeError = validateLongitude(longitude);
    if (longitudeError) errors.longitude = longitudeError;
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ errors });
  }

  const updates = {};
  if (name !== undefined) updates.name = name.trim();
  if (category !== undefined) updates.category = category.trim();
  if (description !== undefined) updates.description = description.trim();
  if (address !== undefined) updates.address = address.trim();
  if (latitude !== undefined) updates.latitude = Number(latitude);
  if (longitude !== undefined) updates.longitude = Number(longitude);

  const updatedGroup = await Group.findByIdAndUpdate(id, { $set: updates }, { new: true, lean: true });

  res.json({
    id: updatedGroup._id,
    name: updatedGroup.name,
    category: updatedGroup.category,
    description: updatedGroup.description,
    address: updatedGroup.address,
    latitude: updatedGroup.latitude,
    longitude: updatedGroup.longitude,
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