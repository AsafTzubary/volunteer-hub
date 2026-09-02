const express = require('express');
const { asyncHandler } = require('../../middlewares/asyncHandler');
const { requireAuth } = require('../../middlewares/auth');
const {
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
} = require('../../controllers/events.controller');

const router = express.Router();

router.get('/upcoming', requireAuth, asyncHandler(listUpcomingEvents));
router.get('/all', requireAuth, asyncHandler(listAllUpcomingEvents));
router.get('/search', requireAuth, asyncHandler(searchEvents));
router.get('/', requireAuth, asyncHandler(listGroupEvents));
router.post('/', requireAuth, asyncHandler(createEvent));
router.get('/:id', requireAuth, asyncHandler(getEventDetails));
router.post('/:id/rsvp', requireAuth, asyncHandler(setRsvp));
router.delete('/:id', requireAuth, asyncHandler(deleteEvent));
router.get('/:id/participants', requireAuth, asyncHandler(getEventParticipants));
router.put('/:id', requireAuth, asyncHandler(updateEvent));

module.exports = router;