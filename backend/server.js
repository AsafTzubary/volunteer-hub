require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');
const { logError } = require('./utils/logger');

const PORT = process.env.PORT || 3000;

process.on('unhandledRejection', (reason) => {
  logError(reason, { status: 500 });
});

// State is unrecoverable after an uncaught exception, so exit for a restart.
process.on('uncaughtException', (err) => {
  logError(err, { status: 500 });
  process.exit(1);
});

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`Volunteer Hub running on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB', err);
    process.exit(1);
  });
