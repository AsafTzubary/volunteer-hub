const express = require('express');
const authRoutes = require('./auth.routes');
const usersRoutes = require('./users.routes');
const groupsRoutes = require('./groups.routes');
const postsRoutes = require('./posts.routes');
const eventsRoutes = require('./events.routes');
const placesRoutes = require('./places.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/groups', groupsRoutes);
router.use('/posts', postsRoutes);
router.use('/events', eventsRoutes);
router.use('/places', placesRoutes);

module.exports = router;
