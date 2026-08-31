// Express 4 only forwards errors thrown synchronously; a rejected async
// handler would otherwise leave the request hanging with no response.
function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { asyncHandler };
