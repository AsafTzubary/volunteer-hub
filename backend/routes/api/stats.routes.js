const express = require('express');
const { requireAuth } = require('../../middlewares/auth');
const { requireAdmin } = require('../../middlewares/requireAdmin');
const { membersByCategory, getCategories } = require('../../controllers/stats.controller');

const router = express.Router();

router.get('/categories', requireAuth, getCategories);
router.get('/members-by-category', requireAdmin, membersByCategory);

module.exports = router;
