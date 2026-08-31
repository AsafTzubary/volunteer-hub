const path = require('path');
const { logError, newRequestId } = require('../utils/logger');

const ERROR_PAGE = path.join(__dirname, '..', '..', 'public', '500.html');
const MONGO_DUPLICATE_KEY = 11000;
const GENERIC_SERVER_MESSAGE = 'Something went wrong on our end. Please try again.';

function isDevelopment() {
  return process.env.NODE_ENV === 'development';
}

function assignRequestId(req, res, next) {
  req.requestId = newRequestId();
  res.setHeader('X-Request-Id', req.requestId);
  next();
}

function statusFor(err) {
  const declared = err.status || err.statusCode;
  if (Number.isInteger(declared) && declared >= 400 && declared < 600) return declared;
  if (err.name === 'ValidationError' || err.name === 'CastError') return 400;
  if (err.code === MONGO_DUPLICATE_KEY) return 409;
  return 500;
}

// `expose` is how body-parser and http-errors mark a message as written for
// the client; anything else could be leaking internals.
function hasClientSafeMessage(err) {
  return Boolean(err.expose && err.message);
}

function clientMessage(status, err) {
  if (status >= 500) return GENERIC_SERVER_MESSAGE;
  return hasClientSafeMessage(err) ? err.message : 'Request could not be processed.';
}

function sendErrorPage(res, status) {
  res.status(status).sendFile(ERROR_PAGE, (sendError) => {
    if (!sendError) return;
    if (res.headersSent) return res.end();
    res.type('text/plain').send(GENERIC_SERVER_MESSAGE);
  });
}

// eslint-disable-next-line no-unused-vars -- Express identifies error handlers
// by their four-parameter signature.
function errorHandler(err, req, res, next) {
  const status = statusFor(err);
  const requestId = req.requestId || newRequestId();

  if (status >= 500) logError(err, { requestId, req, status });

  if (res.headersSent) return next(err);

  if (req.path.startsWith('/api/')) {
    return res.status(status).json({
      error: clientMessage(status, err),
      requestId,
      ...(isDevelopment() && { detail: err.message, stack: err.stack }),
    });
  }

  sendErrorPage(res, status);
}

module.exports = { assignRequestId, errorHandler };
