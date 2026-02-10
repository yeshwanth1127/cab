#!/usr/bin/env node
/**
 * Run all migrations in order.
 * Usage: from backend dir: node db/migrations/run-all.js
 * Or: npm run migrate
 * Loads .env from backend so DATABASE_PATH is used.
 */
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const backendDir = path.join(__dirname, '..', '..');
require('dotenv').config({ path: path.join(backendDir, '.env') });

const migrations = [
  { name: 'rate_meter_tables', script: path.join(__dirname, 'rate_meter_tables.js') },
  { name: 'add-manager-role', script: path.join(__dirname, 'add-manager-role.js') },
  { name: 'add-drivers-email', script: path.join(__dirname, 'add-drivers-email.js') },
];

console.log('Running migrations (DATABASE_PATH:', process.env.DATABASE_PATH || 'default', ')...\n');

for (const m of migrations) {
  console.log('---', m.name, '---');
  const r = spawnSync('node', [m.script], { cwd: backendDir, env: process.env, stdio: 'inherit' });
  if (r.status !== 0) {
    console.error('Migration failed:', m.name);
    process.exit(1);
  }
  console.log('');
}

// Run add_service_type.sql (bookings.service_type)
const db = require('../database');
const sqlPath = path.join(__dirname, 'add_service_type.sql');
if (fs.existsSync(sqlPath)) {
  console.log('--- add_service_type.sql (bookings) ---');
  const sql = fs.readFileSync(sqlPath, 'utf8').trim();
  db.runAsync(sql).then(() => {
    console.log('Done.');
    if (typeof db.close === 'function') db.close(() => process.exit(0));
    else process.exit(0);
  }).catch((e) => {
    if (e.message && (e.message.includes('duplicate column') || e.message.includes('already exists')))
      console.log('Column already exists, skipping.');
    else
      console.error('Error:', e.message);
    if (typeof db.close === 'function') db.close(() => process.exit(0));
    else process.exit(0);
  });
} else {
  process.exit(0);
}
