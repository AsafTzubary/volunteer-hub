const path = require('path');
const express = require('express');
const session = require('express-session');
const mainRouter = require('./routes');
const { assignRequestId, errorHandler } = require('./middlewares/errorHandler');

const app = express();

app.use(assignRequestId);
app.use(express.json({ limit: '10mb' }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 }, // 1 hour, in-memory only
  })
);

app.use(mainRouter);
app.use(express.static(path.join(__dirname, '..', 'public')));

// Task 114: catch-all for anything that didn't match a route or a static
// file. API requests get a JSON 404 (consistent with every other API
// error response); everything else gets the human-readable 404 page.
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found.' });
  }
  res.status(404).sendFile(path.join(__dirname, '..', 'public', '404.html'));
});

app.use(errorHandler);

module.exports = app;
