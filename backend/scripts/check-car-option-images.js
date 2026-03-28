#!/usr/bin/env node
/**
 * Lists car_options and their image_url, and lists files in uploads/car-options/.
 * Run from backend: node scripts/check-car-option-images.js
 */
const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '../.env') });
const db = require('../db/database');

const uploadsDir = path.join(__dirname, '../uploads/car-options');

async function main() {
  const rows = await db.allAsync(
    `SELECT id, name, image_url FROM car_options ORDER BY id`
  ).catch(() => []);

  const files = fs.existsSync(uploadsDir)
    ? fs.readdirSync(uploadsDir)
    : [];

  console.log('--- car_options (id, name, image_url) ---');
  if (rows.length === 0) {
    console.log('No rows in car_options table.');
  } else {
    rows.forEach((r) => {
      const hasImage = r.image_url && String(r.image_url).trim();
      console.log(`${r.id}\t${r.name}\t${hasImage ? r.image_url : '(no image_url)'}`);
    });
  }

  console.log('\n--- Files in uploads/car-options/ ---');
  if (files.length === 0) {
    console.log('No files.');
  } else {
    files.forEach((f) => console.log('  ' + f));
  }

  if (typeof db.close === 'function') {
    db.close(() => {});
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
