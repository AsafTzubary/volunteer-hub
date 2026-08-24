const express = require('express');
const { requireAuth } = require('../../middlewares/auth');
const { listGroupEvents, createEvent } = require('../../controllers/events.controller');

const router = express.Router();

router.get('/', requireAuth, listGroupEvents);
router.post('/', requireAuth, createEvent);


module.exports = router;