const express = require('express');
const { requireAuth } = require('../../middlewares/auth');
const { listGroupEvents, createEvent, listUpcomingEvents, listAllUpcomingEvents, getEventDetails } = require('../../controllers/events.controller');

const router = express.Router();

router.get('/upcoming', requireAuth, listUpcomingEvents);
router.get('/all', requireAuth, listAllUpcomingEvents);
router.get('/', requireAuth, listGroupEvents);
router.post('/', requireAuth, createEvent);
router.get('/:id', requireAuth, getEventDetails);


module.exports = router;