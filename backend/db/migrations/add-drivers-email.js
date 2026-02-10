#!/usr/bin/env node
/**
 * Add email column to drivers table.
 * Usage: from backend dir: node db/migrations/add-drivers-email.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const db = require('../database');

async function run() {
  try {
    await db.runAsync('ALTER TABLE drivers ADD COLUMN email TEXT');
    console.log('✅ drivers.email column added.');
  } catch (e) {
    if (e.message && (e.message.includes('duplicate column') || e.message.includes('already exists')))
      console.log('✅ drivers.email already exists, skipping.');
    else
      throw e;
  }
  if (typeof db.close === 'function') db.close(() => process.exit(0));
  else process.exit(0);
}

run().catch((e) => {
  console.error('Migration failed:', e.message);
  process.exit(1);
});
