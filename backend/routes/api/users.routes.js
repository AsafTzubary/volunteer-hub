const express = require('express');
const { requireAuth } = require('../../middlewares/auth');
const { getProfile, updateProfile, addFriend } = require('../../controllers/users.controller');

const router = express.Router();

router.put('/me', requireAuth, updateProfile);
router.get('/:username', requireAuth, getProfile);
router.post('/:username/friend', requireAuth, addFriend);

module.exports = router;
