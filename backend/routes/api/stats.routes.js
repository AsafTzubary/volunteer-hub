const express = require('express');
const { asyncHandler } = require('../../middlewares/asyncHandler');
const { requireAuth } = require('../../middlewares/auth');
const { requireAdmin } = require('../../middlewares/requireAdmin');
const { membersByCategory, getCategories, registrationsByMonth } = require('../../controllers/stats.controller');

const router = express.Router();

router.get('/categories', requireAuth, asyncHandler(getCategories));
router.get('/members-by-category', requireAdmin, asyncHandler(membersByCategory));
router.get('/registrations-by-month', requireAdmin, asyncHandler(registrationsByMonth));

module.exports = router;
