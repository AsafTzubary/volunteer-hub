const express = require('express');
const { requireAuth } = require('../../middlewares/auth');
const {
  listGroupEvents,
  createEvent,
  listUpcomingEvents,
  listAllUpcomingEvents,
  setRsvp,
  deleteEvent,
  updateEvent,
} = require('../../controllers/events.controller');

const router = express.Router();

router.get('/upcoming', requireAuth, listUpcomingEvents);
router.get('/all', requireAuth, listAllUpcomingEvents);
router.get('/', requireAuth, listGroupEvents);
router.post('/', requireAuth, createEvent);
router.post('/:id/rsvp', requireAuth, setRsvp);
router.delete('/:id', requireAuth, deleteEvent);
router.put('/:id', requireAuth, updateEvent);

module.exports = router;