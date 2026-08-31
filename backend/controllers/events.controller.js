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

// The stored `status` field only ever needs to record a manual, non-derivable
// action (cancelling). "completed" and "full" are both fully determined by
// the event's date and RSVP count, so we compute them fresh on every read
// instead of trying to keep a stored field in sync via a background job.
function computeEventStatus(event) {
  if (event.status === 'cancelled') return 'cancelled';
  if (new Date(event.date) < new Date()) return 'completed';
  const goingCount = countByStatus(event.rsvps || [], 'going');
  if (goingCount >= event.maxParticipants) return 'full';
  return 'upcoming';
}

// Event search parameters (task 73):
//
//   address      - case-insensitive partial match against the event's address.
//   category     - exact match against the event's category.
//   dateFrom     - only events on or after this date (ISO string).
//   dateTo       - only events on or before this date (ISO string).
//   status       - one of 'upcoming' | 'full' | 'completed' | 'cancelled',
//                  matched against computeEventStatus(event) - the same
//                  derived value returned to clients elsewhere, not the raw
//                  stored field, so "full"/"completed" filter correctly.
//   availableOnly - when truthy, only events with at least one open spot
//                  (i.e. computeEventStatus(event) !== 'full' and not
//                  cancelled/completed).
//
// Empty-field behavior: same convention as group search - any omitted or
// blank param is left out of the query rather than excluding results.
//
// Sorting: results are sorted by date ascending (soonest first), matching
// the existing listAllUpcomingEvents/listUpcomingEvents behavior.
//
// Note: like groups, the Event model has no "city" field - address is used
// as the closest available stand-in for location-based search.

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Counts "going" RSVPs as a query-time expression, rather than in JS, so it
// can be compared against maxParticipants inside a Mongo $expr. This is a
// step up from the group-search $size trick since rsvps is an array of
// subdocuments - we have to $filter down to the "going" ones first before
// measuring how many there are.
function goingCountExpr() {
  return {
    $size: {
      $filter: {
        input: { $ifNull: ['$rsvps', []] },
        as: 'r',
        cond: { $eq: ['$$r.status', 'going'] },
      },
    },
  };
}

// Builds the Mongo filter for searchEvents. Each applicable condition is
// pushed independently into an $and array instead of merged into shared
// field objects - that avoids having to manually reconcile a user-supplied
// dateFrom/dateTo with the implicit "must be in the future" requirement that
// the full/upcoming/availableOnly filters add on top.
function buildEventSearchFilter(query) {
  const { address, category, dateFrom, dateTo, status, availableOnly } = query;
  const conditions = [];

  if (address && address.trim()) {
    conditions.push({ address: { $regex: escapeRegex(address.trim()), $options: 'i' } });
  }

  if (category && category.trim()) {
    conditions.push({ category: category.trim() });
  }

  if (dateFrom) {
    const from = new Date(dateFrom);
    if (!isNaN(from)) conditions.push({ date: { $gte: from } });
  }

  if (dateTo) {
    const to = new Date(dateTo);
    if (!isNaN(to)) conditions.push({ date: { $lte: to } });
  }

  const now = new Date();
  const hasRoomExpr = { $expr: { $lt: [goingCountExpr(), '$maxParticipants'] } };

  if (status === 'cancelled') {
    conditions.push({ status: 'cancelled' });
  } else if (status === 'completed') {
    conditions.push({ status: { $ne: 'cancelled' } }, { date: { $lt: now } });
  } else if (status === 'full') {
    conditions.push(
      { status: { $ne: 'cancelled' } },
      { date: { $gte: now } },
      { $expr: { $gte: [goingCountExpr(), '$maxParticipants'] } }
    );
  } else if (status === 'upcoming') {
    conditions.push({ status: { $ne: 'cancelled' } }, { date: { $gte: now } }, hasRoomExpr);
  } else if (availableOnly) {
    // Not already constrained by a status above - availableOnly on its own
    // means the same thing as status=upcoming's "has room" condition.
    conditions.push({ status: { $ne: 'cancelled' } }, { date: { $gte: now } }, hasRoomExpr);
  }

  return conditions.length > 0 ? { $and: conditions } : {};
}

const EVENT_SORT_OPTIONS = {
  date_asc: { date: 1 },
  date_desc: { date: -1 },
  createdAt_desc: { createdAt: -1 },
};

function resolveEventSort(sortParam) {
  return EVENT_SORT_OPTIONS[sortParam] || EVENT_SORT_OPTIONS.date_asc;
}

const EVENT_SEARCH_PAGE_SIZE = 9;

async function searchEvents(req, res) {
  const filter = buildEventSearchFilter(req.query);
  const sort = resolveEventSort(req.query.sort);
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const skip = (page - 1) * EVENT_SEARCH_PAGE_SIZE;

  const [events, totalCount] = await Promise.all([
    Event.find(filter)
      .populate('manager', 'username fullName')
      .populate('group', 'name')
      .sort(sort)
      .skip(skip)
      .limit(EVENT_SEARCH_PAGE_SIZE)
      .lean(),
    Event.countDocuments(filter),
  ]);

  res.json({
    events: events.map((event) => ({
      id: event._id,
      title: event.title,
      category: event.category,
      description: event.description,
      address: event.address,
      date: event.date,
      maxParticipants: event.maxParticipants,
      participantsCount: countByStatus(event.rsvps || [], 'going'),
      status: computeEventStatus(event),
      manager: event.manager,
      group: { id: event.group._id, name: event.group.name },
    })),
    page,
    totalPages: Math.max(1, Math.ceil(totalCount / EVENT_SEARCH_PAGE_SIZE)),
    totalCount,
  });
}


async function listGroupEvents(req, res) {
  const { groupId } = req.query;
  if (!groupId || !mongoose.isValidObjectId(groupId)) {
    return res.status(400).json({ error: 'Valid groupId is required.' });
  }
  const [events, user] = await Promise.all([
    Event.find({ group: groupId, date: { $gte: new Date() }, status: { $ne: 'cancelled' } })
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
      status: computeEventStatus(event),
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
      status: computeEventStatus(event),
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
      latitude: event.latitude,
      longitude: event.longitude,
      date: event.date,
      maxParticipants: event.maxParticipants,
      participantsCount: countByStatus(event.rsvps || [], 'going'),
      status: computeEventStatus(event),
      manager: event.manager,
      group: { id: event.group._id, name: event.group.name },
    }))
  );
}

async function getEventDetails(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(404).json({ error: 'Event not found.' });
  const viewerUsername = req.session.username;
  const [event, viewer] = await Promise.all([
    Event.findById(id)
      .populate('group', 'name')
      .populate('manager', 'username fullName')
      .lean(),
    User.findOne({ username: viewerUsername }).select('_id').lean(),
  ]);
  if (!event) return res.status(404).json({ error: 'Event not found.' });
  const isManager = event.manager?.username === viewerUsername;
  const summary = rsvpSummary(event, viewer?._id);
  res.json({
    id: event._id,
    title: event.title,
    description: event.description,
    category: event.category,
    address: event.address,
    date: event.date,
    maxParticipants: event.maxParticipants,
    availablePlaces: event.maxParticipants - summary.participantsCount,
    status: computeEventStatus(event),
    group: event.group,
    manager: event.manager,
    isManager,
    ...summary,
  });
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
  const event = await Event.findById(id).select('manager group status').lean();
  if (!event) return res.status(404).json({ error: 'Event not found.' });
  const [group, user] = await Promise.all([
    Group.findById(event.group).select('manager').lean(),
    User.findOne({ username: req.session.username }).select('_id').lean(),
  ]);
  if (!event.manager.equals(user._id) && !group.manager.equals(user._id)) {
    return res.status(403).json({ error: 'Only the group manager can cancel this event.' });
  }
  if (event.status === 'cancelled') {
    return res.status(409).json({ error: 'This event is already cancelled.' });
  }
  // Cancelling marks the event rather than deleting it, so history and past
  // RSVPs are preserved and the event can still be viewed by its manager/group.
  await Event.updateOne({ _id: id }, { $set: { status: 'cancelled' } });
  res.json({ message: 'Event cancelled successfully.' });
}

async function getEventParticipants(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(404).json({ error: 'Event not found.' });
  }
  const event = await Event.findById(id)
    .select('manager group rsvps')
    .populate('rsvps.user', 'username fullName city')
    .lean();
  if (!event) return res.status(404).json({ error: 'Event not found.' });
  const [group, user] = await Promise.all([
    Group.findById(event.group).select('manager').lean(),
    User.findOne({ username: req.session.username }).select('_id').lean(),
  ]);
  if (!event.manager.equals(user._id) && !group.manager.equals(user._id)) {
    return res.status(403).json({ error: 'Only the group manager can view participants.' });
  }
  const participants = (event.rsvps || [])
    .filter((rsvp) => rsvp.status === 'going')
    .map((rsvp) => ({
      username: rsvp.user.username,
      fullName: rsvp.user.fullName,
      city: rsvp.user.city,
    }));
  res.json({ participants });
}

async function updateEvent(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(404).json({ error: 'Event not found.' });
  }
  const event = await Event.findById(id).select('manager group rsvps').lean();
  if (!event) return res.status(404).json({ error: 'Event not found.' });
  const [group, user] = await Promise.all([
    Group.findById(event.group).select('manager').lean(),
    User.findOne({ username: req.session.username }).select('_id').lean(),
  ]);
  if (!event.manager.equals(user._id) && !group.manager.equals(user._id)) {
    return res.status(403).json({ error: 'Only the group manager can edit this event.' });
  }
  const { title, category, description, address, latitude, longitude, date, maxParticipants } = req.body;
  const errors = {};
  if (title !== undefined) {
    const titleError = validateEventTitle(title);
    if (titleError) errors.title = titleError;
  }
  if (category !== undefined) {
    const categoryError = validateCategory(category);
    if (categoryError) errors.category = categoryError;
  }
  if (description !== undefined) {
    const descriptionError = validateEventDescription(description);
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
  if (date !== undefined) {
    const dateError = validateEventDate(date);
    if (dateError) errors.date = dateError;
  }
  if (maxParticipants !== undefined) {
    const maxParticipantsError = validateMaxParticipants(maxParticipants);
    if (maxParticipantsError) errors.maxParticipants = maxParticipantsError;
  }
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ errors });
  }
  if (maxParticipants !== undefined) {
    const goingCount = countByStatus(event.rsvps || [], 'going');
    if (Number(maxParticipants) < goingCount) {
      return res.status(409).json({
        error: `Cannot set capacity below the ${goingCount} participant(s) already registered.`,
      });
    }
  }
  const updates = {};
  if (title !== undefined) updates.title = title.trim();
  if (category !== undefined) updates.category = category.trim();
  if (description !== undefined) updates.description = description.trim();
  if (address !== undefined) updates.address = address.trim();
  if (latitude !== undefined) updates.latitude = Number(latitude);
  if (longitude !== undefined) updates.longitude = Number(longitude);
  if (date !== undefined) updates.date = new Date(date);
  if (maxParticipants !== undefined) updates.maxParticipants = Number(maxParticipants);
  const updatedEvent = await Event.findByIdAndUpdate(id, { $set: updates }, { new: true, lean: true });
  res.json({
    id: updatedEvent._id,
    title: updatedEvent.title,
    category: updatedEvent.category,
    description: updatedEvent.description,
    address: updatedEvent.address,
    latitude: updatedEvent.latitude,
    longitude: updatedEvent.longitude,
    date: updatedEvent.date,
    maxParticipants: updatedEvent.maxParticipants,
  });
}

module.exports = {
  listGroupEvents,
  createEvent,
  listUpcomingEvents,
  listAllUpcomingEvents,
  getEventDetails,
  setRsvp,
  deleteEvent,
  getEventParticipants,
  updateEvent,
  searchEvents,
};