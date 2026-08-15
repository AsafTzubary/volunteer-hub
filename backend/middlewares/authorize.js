function requireOwner(getOwnerFn) {
  return function (req, res, next) {
    const owner = getOwnerFn(req);
    if (!owner || owner !== req.session.username) {
      return res.status(403).json({ error: 'Forbidden.' });
    }
    next();
  };
}

module.exports = { requireOwner };
