const express = require('express');
const { asyncHandler } = require('../../middlewares/asyncHandler');
const { requireAuth } = require('../../middlewares/auth');
const {
  listUsers,
  getProfile,
  updateProfile,
  addFriend,
  removeFriend,
} = require('../../controllers/users.controller');

const router = express.Router();

router.get('/', requireAuth, asyncHandler(listUsers));
router.put('/me', requireAuth, asyncHandler(updateProfile));
router.get('/:username', requireAuth, asyncHandler(getProfile));
router.post('/:username/friend', requireAuth, asyncHandler(addFriend));
router.delete('/:username/friend', requireAuth, asyncHandler(removeFriend));

module.exports = router;
