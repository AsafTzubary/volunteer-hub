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
    Group.findById(groupId).select('manager').lean(),
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

module.exports = { createEvent };