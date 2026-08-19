const express = require('express');
const { requireAuth } = require('../../middlewares/auth');
const { getGroupDetails, getManagedGroup, createGroup } = require('../../controllers/groups.controller');

const router = express.Router();

router.get('/mine', requireAuth, getManagedGroup);
router.get('/:id', requireAuth, getGroupDetails);
router.post('/', requireAuth, createGroup);

module.exports = router;