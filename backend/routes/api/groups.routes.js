const express = require('express');
const { asyncHandler } = require('../../middlewares/asyncHandler');
const { requireAuth } = require('../../middlewares/auth');
const {
  listGroups,
  getGroupDetails,
  getManagedGroup,
  createGroup,
  updateGroup,
  deleteGroup,
  joinGroup,
  leaveGroup,
  removeMember,
  transferOwnership,
} = require('../../controllers/groups.controller');

const router = express.Router();

router.get('/', requireAuth, asyncHandler(listGroups));
router.get('/mine', requireAuth, asyncHandler(getManagedGroup));
router.get('/:id', requireAuth, asyncHandler(getGroupDetails));
router.post('/', requireAuth, asyncHandler(createGroup));
router.put('/:id', requireAuth, asyncHandler(updateGroup));
router.delete('/:id', requireAuth, asyncHandler(deleteGroup));
router.post('/:id/join', requireAuth, asyncHandler(joinGroup));
router.post('/:id/leave', requireAuth, asyncHandler(leaveGroup));
router.delete('/:id/members/:username', requireAuth, asyncHandler(removeMember));
router.post('/:id/manager/:username', requireAuth, asyncHandler(transferOwnership));

module.exports = router;