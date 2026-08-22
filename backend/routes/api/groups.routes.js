const express = require('express');
const { requireAuth } = require('../../middlewares/auth');
const { getGroupDetails, getManagedGroup, createGroup, joinGroup, leaveGroup } = require('../../controllers/groups.controller');

const router = express.Router();

router.get('/mine', requireAuth, getManagedGroup);
router.get('/:id', requireAuth, getGroupDetails);
router.post('/', requireAuth, createGroup);
router.post('/:id/join', requireAuth, joinGroup);
router.post('/:id/leave', requireAuth, leaveGroup);

module.exports = router;