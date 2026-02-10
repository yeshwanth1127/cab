/**
 * Ensures DB has schema (from db/schema.sql), then creates or updates admin user.
 * Usage: node scripts/seed-admin.js [username] [password] [email]
 * Default: admin / admin123 / admin@cabcompany.com
 *
 * Use DATABASE_PATH to point to your db file, e.g.:
 *   DATABASE_PATH=/var/www/nammacabs.com/cab/backend/cab.db node scripts/seed-admin.js admin admin123
 */
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'db', 'cab_booking.db');
const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');

// Use dynamic require so we can set env before loading database
process.env.DATABASE_PATH = dbPath;
const db = require('../db/database');

async function runSchemaIfNeeded() {
  const exists = await db.getAsync(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
  );
  if (exists) return;
  const schema = fs.readFileSync(schemaPath, 'utf8');
  const statements = schema
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'));
  for (const stmt of statements) {
    if (stmt) await db.runAsync(stmt + ';');
  }
  console.log('Database schema initialized.');
}

async function seedAdmin() {
  const username = process.argv[2] || 'admin';
  const password = process.argv[3] || 'admin123';
  const email = process.argv[4] || 'admin@cabcompany.com';

  await runSchemaIfNeeded();

  const passwordHash = await bcrypt.hash(password, 10);
  const existing = await db.getAsync('SELECT id FROM users WHERE username = ?', [username]);

  if (existing) {
    await db.runAsync(
      `UPDATE users SET password_hash = ?, email = ?, role = 'admin' WHERE username = ?`,
      [passwordHash, email, username]
    );
    console.log(`Admin user "${username}" updated.`);
  } else {
    await db.runAsync(
      `INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, 'admin')`,
      [username, email, passwordHash]
    );
    console.log(`Admin user "${username}" created.`);
  }
  console.log(`  Username: ${username}`);
  console.log(`  Password: ${password}`);
  console.log(`  Email: ${email}`);
}

function close() {
  if (typeof db.close === 'function') {
    db.close((err) => {
      if (err) console.error('Error closing DB:', err);
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

seedAdmin()
  .then(close)
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
