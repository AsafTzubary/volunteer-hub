# Volunteer Hub

A platform for setting up and joining volunteer groups and activities.

**Stack:** vanilla HTML/CSS/JS + Bootstrap (frontend), Express/Node.js (backend), MongoDB via Docker (database).

## Setup

1. Start MongoDB:

   ```bash
   docker compose up -d
   ```

2. Install backend dependencies:

   ```bash
   cd backend
   npm install
   ```

3. Seed the admin user (username: `admin`, password: `password`):

   ```bash
   npm run seed
   ```

4. Start the server:

   ```bash
   npm start
   ```

5. Open http://localhost:3000 and log in, or register a new account.

## Notes

- Login/session data is kept in memory only — nothing is persisted to the database beyond the user's hashed password.
- Passwords are hashed with bcrypt before being stored.
