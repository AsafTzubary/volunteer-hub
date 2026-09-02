const User = require('../models/User');
const { asyncHandler } = require('./asyncHandler');

async function requireAdmin(req, res, next) {
  if (!req.session.username) {
    return res.status(401).json({ error: 'Not logged in.' });
  }
  const user = await User.findOne({ username: req.session.username });
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden.' });
  }
  next();
}

module.exports = { requireAdmin: asyncHandler(requireAdmin) };
