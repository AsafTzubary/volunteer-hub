const express = require('express');
const { requireAuth } = require('../../middlewares/auth');
const {
  listGroups,
  getGroupDetails,
  getManagedGroup,
  createGroup,
} = require('../../controllers/groups.controller');

const router = express.Router();

router.get('/', requireAuth, listGroups);
router.get('/mine', requireAuth, getManagedGroup);
router.get('/:id', requireAuth, getGroupDetails);
router.post('/', requireAuth, createGroup);

module.exports = router;