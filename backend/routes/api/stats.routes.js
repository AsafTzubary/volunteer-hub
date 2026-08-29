const express = require('express');
const { requireAuth } = require('../../middlewares/auth');
const { requireAdmin } = require('../../middlewares/requireAdmin');
const { membersByCategory, getCategories, registrationsByMonth } = require('../../controllers/stats.controller');

const router = express.Router();

router.get('/categories', requireAuth, getCategories);
router.get('/members-by-category', requireAdmin, membersByCategory);
router.get('/registrations-by-month', requireAdmin, registrationsByMonth);

module.exports = router;
