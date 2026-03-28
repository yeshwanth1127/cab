#!/usr/bin/env node
/**
 * Fix car_options.image_url: DB has paths like /etios.jpg but files are
 * in uploads/car-options/ with timestamp prefix (e.g. 1765628502293-etios.jpg).
 * This script updates each row to point to the correct file.
 * Run from backend: node scripts/fix-car-option-image-paths.js
 */
const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '../.env') });
const db = require('../db/database');

const UPLOADS_DIR = path.join(__dirname, '../uploads/car-options');

function parseImageUrl(imageUrl) {
  if (!imageUrl || !String(imageUrl).trim()) return null;
  const s = String(imageUrl).trim();
  try {
    const parsed = JSON.parse(s);
    const first = Array.isArray(parsed) ? parsed[0] : parsed;
    return typeof first === 'string' ? first : null;
  } catch {
    return s;
  }
}

function findMatchingFile(logicalPath, files) {
  if (!logicalPath || files.length === 0) return null;
  const base = logicalPath.replace(/^\//, '').toLowerCase();
  const ext = path.extname(base);
  const nameWithoutExt = path.basename(base, ext).replace(/\s+/g, '-').replace(/\+/g, '+');

  for (const f of files) {
    const fLower = f.toLowerCase();
    const fName = path.basename(fLower, path.extname(f));
    const fExt = path.extname(fLower);
    if (fExt !== ext) continue;
    if (fName === nameWithoutExt) return f;
    if (fName.endsWith('-' + nameWithoutExt)) return f;
    if (fName.includes(nameWithoutExt) || fLower.includes(base.replace(ext, ''))) return f;
  }
  return null;
}

async function main() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    console.error('uploads/car-options directory not found');
    process.exit(1);
  }

  const files = fs.readdirSync(UPLOADS_DIR);
  const rows = await db.allAsync('SELECT id, name, image_url FROM car_options ORDER BY id');
  let updated = 0;

  for (const row of rows) {
    const current = parseImageUrl(row.image_url);
    const logicalPath = current ? current.replace(/^\/uploads\/?/, '').replace(/^car-options\/?/, '') : null;
    const logicalName = logicalPath ? path.basename(logicalPath) : null;

    const match = logicalName ? findMatchingFile('/' + logicalName, files) : null;
    if (!match) {
      console.log(`Skip (no match): id=${row.id} name=${row.name} current=${current || 'null'}`);
      continue;
    }

    const newPath = 'car-options/' + match;
    const newImageUrl = JSON.stringify([newPath]);
    await db.runAsync('UPDATE car_options SET image_url = ? WHERE id = ?', [newImageUrl, row.id]);
    console.log(`Updated id=${row.id} ${row.name}: ${current} -> ${newPath}`);
    updated++;
  }

  console.log('\nDone. Updated', updated, 'rows.');
  if (typeof db.close === 'function') db.close(() => {});
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
