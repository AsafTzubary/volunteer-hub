const express = require('express');
const { requireAuth } = require('../../middlewares/auth');
const { createEvent } = require('../../controllers/events.controller');

const router = express.Router();

router.post('/', requireAuth, createEvent);

module.exports = router;