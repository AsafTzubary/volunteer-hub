const express = require('express');
const { requireAuth } = require('../../middlewares/auth');
const { getGroupDetails } = require('../../controllers/groups.controller');

const router = express.Router();

router.get('/:id', requireAuth, getGroupDetails);

module.exports = router;