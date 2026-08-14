const express = require('express');
const { requireAuth } = require('../../middlewares/auth');
const { getProfile } = require('../../controllers/users.controller');

const router = express.Router();

router.get('/:username', requireAuth, getProfile);

module.exports = router;
