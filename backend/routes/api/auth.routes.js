const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../../models/User');
const { validateUsername, validatePassword } = require('../../utils/validators');

const router = express.Router();

router.post('/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const usernameError = validateUsername(username);
  if (usernameError) {
    return res.status(400).json({ error: usernameError });
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  const existing = await User.findOne({ username });
  if (existing) {
    return res.status(409).json({ error: 'Username is already taken.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ username, passwordHash });

  req.session.username = user.username;
  res.status(201).json({ username: user.username });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const user = await User.findOne({ username });
  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  req.session.username = user.username;
  res.json({ username: user.username });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

router.get('/me', (req, res) => {
  if (!req.session.username) {
    return res.status(401).json({ error: 'Not logged in.' });
  }
  res.json({ username: req.session.username });
});

module.exports = router;
