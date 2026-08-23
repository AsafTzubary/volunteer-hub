const express = require('express');
const { requireAuth } = require('../../middlewares/auth');
const { getProfile, updateProfile, addFriend, removeFriend } = require('../../controllers/users.controller');

const router = express.Router();

router.put('/me', requireAuth, updateProfile);
router.get('/:username', requireAuth, getProfile);
router.post('/:username/friend', requireAuth, addFriend);
router.delete('/:username/friend', requireAuth, removeFriend);

module.exports = router;
