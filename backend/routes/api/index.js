const express = require('express');
const authRoutes = require('./auth.routes');
const usersRoutes = require('./users.routes');
const groupsRoutes = require('./groups.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/groups', groupsRoutes);

module.exports = router;
