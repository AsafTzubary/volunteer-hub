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
  validateRsvpStatus,
} = require('../utils/validators');
const { announceNewEvent } = require('../utils/event-announcer');

function countByStatus(rsvps, status) {
  return rsvps.filter((rsvp) => rsvp.status === status).length;
}

function rsvpSummary(event, viewerId) {
  const rsvps = event.rsvps || [];
  const myRsvp = viewerId && rsvps.find((rsvp) => rsvp.user.equals(viewerId));
  return {
    participantsCount: countByStatus(rsvps, 'going'),
    interestedCount: countByStatus(rsvps, 'interested'),
    notGoingCount: countByStatus(rsvps, 'not_going'),
    myStatus: myRsvp ? myRsvp.status : null,
    isParticipant: Boolean(myRsvp && myRsvp.status === 'going'),
  };
}

async function listGroupEvents(req, res) {
  const { groupId } = req.query;

  if (!groupId || !mongoose.isValidObjectId(groupId)) {
    return res.status(400).json({ error: 'Valid groupId is required.' });
  }

  const [events, user] = await Promise.all([
    Event.find({ group: groupId, date: { $gte: new Date() } })
      .populate('manager', 'username fullName')
      .sort({ date: 1 })
      .lean(),
    User.findOne({ username: req.session.username }).select('_id').lean(),
  ]);

  res.json(
    events.map((event) => ({
      id: event._id,
      title: event.title,
      category: event.category,
      description: event.description,
      address: event.address,
      date: event.date,
      maxParticipants: event.maxParticipants,
      status: event.status,
      manager: event.manager,
      createdAt: event.createdAt,
      ...rsvpSummary(event, user._id),
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
    rsvps: event.rsvps,
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

  res.json(
    events.map((event) => ({
      id: event._id,
      title: event.title,
      category: event.category,
      description: event.description,
      address: event.address,
      date: event.date,
      maxParticipants: event.maxParticipants,
      status: event.status,
      manager: event.manager,
      group: { id: event.group._id, name: event.group.name },
      ...rsvpSummary(event, user._id),
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
      participantsCount: countByStatus(event.rsvps || [], 'going'),
      status: event.status,
      manager: event.manager,
      group: { id: event.group._id, name: event.group.name },
    }))
  );
}

async function setRsvp(req, res) {
  const { id } = req.params;
  const { status } = req.body;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(404).json({ error: 'Event not found.' });
  }

  if (status) {
    const statusError = validateRsvpStatus(status);
    if (statusError) return res.status(400).json({ error: statusError });
  }

  const event = await Event.findById(id).select('group maxParticipants rsvps').lean();
  if (!event) return res.status(404).json({ error: 'Event not found.' });

  const [group, user] = await Promise.all([
    Group.findById(event.group).select('manager members').lean(),
    User.findOne({ username: req.session.username }).select('_id').lean(),
  ]);

  const isMember =
    group.manager.equals(user._id) || group.members.some((member) => member.equals(user._id));
  if (!isMember) {
    return res.status(403).json({ error: 'Only group members can respond to this event.' });
  }

  const myRsvp = event.rsvps.find((rsvp) => rsvp.user.equals(user._id));
  const isAlreadyGoing = myRsvp && myRsvp.status === 'going';

  if (status === 'going' && !isAlreadyGoing) {
    if (countByStatus(event.rsvps, 'going') >= event.maxParticipants) {
      return res.status(409).json({ error: 'This event is already full.' });
    }
  }

  await Event.updateOne({ _id: id }, { $pull: { rsvps: { user: user._id } } });
  if (status) {
    await Event.updateOne({ _id: id }, { $push: { rsvps: { user: user._id, status } } });
  }

  const updated = await Event.findById(id).select('rsvps maxParticipants').lean();

  res.json({ id, maxParticipants: updated.maxParticipants, ...rsvpSummary(updated, user._id) });
}

async function deleteEvent(req, res) {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(404).json({ error: 'Event not found.' });
  }

  const event = await Event.findById(id).select('manager group').lean();
  if (!event) return res.status(404).json({ error: 'Event not found.' });

  const [group, user] = await Promise.all([
    Group.findById(event.group).select('manager').lean(),
    User.findOne({ username: req.session.username }).select('_id').lean(),
  ]);

  if (!event.manager.equals(user._id) && !group.manager.equals(user._id)) {
    return res.status(403).json({ error: 'Only the group manager can delete this event.' });
  }

  await Event.deleteOne({ _id: id });

  res.json({ message: 'Event deleted successfully.' });
}

module.exports = {
  listGroupEvents,
  createEvent,
  listUpcomingEvents,
  listAllUpcomingEvents,
  setRsvp,
  deleteEvent,
};