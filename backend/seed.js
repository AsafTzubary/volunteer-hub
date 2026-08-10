require('dotenv').config();
const bcrypt = require('bcryptjs');
const connectDB = require('./db');
const User = require('./models/User');

async function seed() {
  await connectDB();

  const existing = await User.findOne({ username: 'admin' });
  if (existing) {
    console.log('Admin user already exists, skipping.');
  } else {
    const passwordHash = await bcrypt.hash('password', 10);
    await User.create({ username: 'admin', passwordHash });
    console.log('Created admin user (username: admin, password: password).');
  }

  process.exit(0);
}

seed().catch((err) => {
  console.error('Seeding failed', err);
  process.exit(1);
});
