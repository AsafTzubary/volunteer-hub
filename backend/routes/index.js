const express = require('express');
const { requireDatabase } = require('../middlewares/requireDatabase');
const apiRoutes = require('./api');

const router = express.Router();

router.use('/api', requireDatabase, apiRoutes);

module.exports = router;
