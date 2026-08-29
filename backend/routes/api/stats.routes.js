const express = require('express');
const { requireAuth } = require('../../middlewares/auth');
const { membersByCategory } = require('../../controllers/stats.controller');

const router = express.Router();

router.get('/members-by-category', requireAuth, membersByCategory);

module.exports = router;
