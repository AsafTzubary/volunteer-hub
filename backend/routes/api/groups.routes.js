const express = require('express');
const { requireAuth } = require('../../middlewares/auth');
const {
  listGroups,
  getGroupDetails,
  getManagedGroup,
  createGroup,
  updateGroup,
  joinGroup,
  leaveGroup,
  removeMember,
} = require('../../controllers/groups.controller');

const router = express.Router();

router.get('/', requireAuth, listGroups);
router.get('/mine', requireAuth, getManagedGroup);
router.get('/:id', requireAuth, getGroupDetails);
router.post('/', requireAuth, createGroup);
router.put('/:id', requireAuth, updateGroup);
router.post('/:id/join', requireAuth, joinGroup);
router.post('/:id/leave', requireAuth, leaveGroup);
router.delete('/:id/members/:username', requireAuth, removeMember);

module.exports = router;