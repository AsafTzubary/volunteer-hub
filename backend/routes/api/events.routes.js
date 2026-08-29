const express = require('express');
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
} = require('../../controllers/events.controller');

const router = express.Router();

router.get('/upcoming', requireAuth, listUpcomingEvents);
router.get('/all', requireAuth, listAllUpcomingEvents);
router.get('/', requireAuth, listGroupEvents);
router.post('/', requireAuth, createEvent);
router.get('/:id', requireAuth, getEventDetails);
router.post('/:id/rsvp', requireAuth, setRsvp);
router.delete('/:id', requireAuth, deleteEvent);
router.get('/:id/participants', requireAuth, getEventParticipants);
router.put('/:id', requireAuth, updateEvent);

module.exports = router;