const express = require('express');
const { requireAuth } = require('../../middlewares/auth');
const { listGroupEvents, createEvent, listUpcomingEvents, listAllUpcomingEvents } = require('../../controllers/events.controller');

const router = express.Router();

router.get('/upcoming', requireAuth, listUpcomingEvents);
router.get('/all', requireAuth, listAllUpcomingEvents);
router.get('/', requireAuth, listGroupEvents);
router.post('/', requireAuth, createEvent);


module.exports = router;