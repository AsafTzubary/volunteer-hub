const mongoose = require('mongoose');
const Group = require('../models/Group');

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

module.exports = { getGroupDetails };