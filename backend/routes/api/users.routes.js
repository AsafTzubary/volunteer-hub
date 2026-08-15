const express = require('express');
const { requireAuth } = require('../../middlewares/auth');
const { getProfile, updateProfile } = require('../../controllers/users.controller');

const router = express.Router();

router.put('/me', requireAuth, updateProfile);
router.get('/:username', requireAuth, getProfile);

module.exports = router;
