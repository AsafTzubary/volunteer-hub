const mongoose = require('mongoose');

const RETRY_AFTER_SECONDS = 10;
const USABLE_STATES = [
  mongoose.ConnectionStates.connected,
  mongoose.ConnectionStates.connecting,
];

function requireDatabase(req, res, next) {
  if (USABLE_STATES.includes(mongoose.connection.readyState)) return next();

  res.setHeader('Retry-After', RETRY_AFTER_SECONDS);
  const err = new Error('Database connection is unavailable');
  err.status = 503;
  next(err);
}

module.exports = { requireDatabase };
