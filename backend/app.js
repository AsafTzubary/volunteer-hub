const path = require('path');
const express = require('express');
const session = require('express-session');
const mainRouter = require('./routes');

const app = express();

app.use(express.json());
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

module.exports = app;
