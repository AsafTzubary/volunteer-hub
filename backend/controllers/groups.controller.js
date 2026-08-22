const mongoose = require('mongoose');
const Group = require('../models/Group');
const User = require('../models/User');
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

module.exports = { listGroups, getGroupDetails, getManagedGroup, createGroup };