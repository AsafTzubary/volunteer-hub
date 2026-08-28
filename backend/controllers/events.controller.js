const mongoose = require('mongoose');
const Event = require('../models/Event');
const Group = require('../models/Group');
const User = require('../models/User');
const {
  validateEventTitle,
  validateEventDescription,
  validateCategory,
  validateAddress,
  validateLatitude,
  validateLongitude,
  validateEventDate,
  validateMaxParticipants,
} = require('../utils/validators');
const { announceNewEvent } = require('../utils/event-announcer');

async function listGroupEvents(req, res) {
  const { groupId } = req.query;

  if (!groupId || !mongoose.isValidObjectId(groupId)) {
    return res.status(400).json({ error: 'Valid groupId is required.' });
  }

  const events = await Event.find({ group: groupId, date: { $gte: new Date() } })
    .populate('manager', 'username fullName')
    .sort({ date: 1 })
    .lean();

  res.json(
    events.map((event) => ({
      id: event._id,
      title: event.title,
      category: event.category,
      description: event.description,
      address: event.address,
      date: event.date,
      maxParticipants: event.maxParticipants,
      participantsCount: event.participants.length,
      status: event.status,
      manager: event.manager,
      createdAt: event.createdAt,
    }))
  );
}

async function createEvent(req, res) {
  const {
    groupId,
    title,
    category,
    description = '',
    address = '',
    latitude,
    longitude,
    date,
    maxParticipants,
  } = req.body;

  if (!groupId || !mongoose.isValidObjectId(groupId)) {
    return res.status(400).json({ error: 'Valid groupId is required.' });
  }

  const titleError = validateEventTitle(title);
  if (titleError) return res.status(400).json({ error: titleError });

  const categoryError = validateCategory(category);
  if (categoryError) return res.status(400).json({ error: categoryError });

  const descriptionError = validateEventDescription(description);
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

  const dateError = validateEventDate(date);
  if (dateError) return res.status(400).json({ error: dateError });

  const maxParticipantsError = validateMaxParticipants(maxParticipants);
  if (maxParticipantsError) return res.status(400).json({ error: maxParticipantsError });

  const [group, user] = await Promise.all([
    Group.findById(groupId).select('manager name').lean(),
    User.findOne({ username: req.session.username }).select('_id').lean(),
  ]);

  if (!group) return res.status(404).json({ error: 'Group not found.' });

  if (!group.manager.equals(user._id)) {
    return res.status(403).json({ error: 'Only the group manager can create events for this group.' });
  }

  const event = await Event.create({
    title: title.trim(),
    category: category.trim(),
    description: description.trim(),
    address: address.trim(),
    ...(latitude !== undefined && { latitude: Number(latitude) }),
    ...(longitude !== undefined && { longitude: Number(longitude) }),
    date: new Date(date),
    maxParticipants: Number(maxParticipants),
    group: groupId,
    manager: user._id,
  });

  // Fire and forget: announcing the event must not delay or fail this response.
  announceNewEvent(event, group.name);

  res.status(201).json({
    id: event._id,
    title: event.title,
    category: event.category,
    description: event.description,
    address: event.address,
    latitude: event.latitude,
    longitude: event.longitude,
    date: event.date,
    maxParticipants: event.maxParticipants,
    status: event.status,
    group: event.group,
    manager: event.manager,
    participants: event.participants,
    createdAt: event.createdAt,
  });
}

async function listUpcomingEvents(req, res) {
  const user = await User.findOne({ username: req.session.username })
    .select('joinedGroups _id')
    .lean();

  if (!user) return res.status(401).json({ error: 'Not authenticated.' });

  const events = await Event.find({
    group: { $in: user.joinedGroups },
    date: { $gte: new Date() },
    status: { $ne: 'cancelled' },
  })
    .populate('manager', 'username fullName')
    .populate('group', 'name')
    .sort({ date: 1 })
    .lean();

  const userId = user._id.toString();

  res.json(
    events.map((event) => ({
      id: event._id,
      title: event.title,
      category: event.category,
      description: event.description,
      address: event.address,
      date: event.date,
      maxParticipants: event.maxParticipants,
      participantsCount: event.participants.length,
      status: event.status,
      manager: event.manager,
      group: { id: event.group._id, name: event.group.name },
      isParticipant: event.participants.some((p) => p.toString() === userId),
    }))
  );
}

async function listAllUpcomingEvents(req, res) {
  const events = await Event.find({
    date: { $gte: new Date() },
    status: { $ne: 'cancelled' },
  })
    .populate('manager', 'username fullName')
    .populate('group', 'name')
    .sort({ date: 1 })
    .lean();

  res.json(
    events.map((event) => ({
      id: event._id,
      title: event.title,
      category: event.category,
      description: event.description,
      address: event.address,
      date: event.date,
      maxParticipants: event.maxParticipants,
      participantsCount: event.participants.length,
      status: event.status,
      manager: event.manager,
      group: { id: event.group._id, name: event.group.name },
    }))
  );
}

module.exports = { listGroupEvents, createEvent, listUpcomingEvents, listAllUpcomingEvents };