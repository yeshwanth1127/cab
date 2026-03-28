#!/usr/bin/env node
/**
 * Seed cabs.image_url from files in uploads/car-options/.
 * Maps cab_type name to a matching image (Sedan -> dzire/ciaz/etios, SUV -> ertiga/marazzo, Innova/Crysta -> innova, etc.).
 * Run from backend: node scripts/seed-cab-images.js
 */
const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '../.env') });
const db = require('../db/database');

const UPLOADS_DIR = path.join(__dirname, '../uploads/car-options');

const CAB_TYPE_TO_KEYWORDS = {
  sedan: ['dzire', 'ciaz', 'etios', 'city'],
  suv: ['ertiga', 'marazzo', 'rumion'],
  'innova crysta': ['innova', 'crysta'],
  crysta: ['innova'],
  innova: ['innova'],
  tt: ['9+1', '12+1', 'urbania'],
  minibus: ['urbania', 'urb13', 'urb15', '12+1', '9+1'],
};

function pickImageForCabType(cabTypeName, files) {
  const name = (cabTypeName || '').trim().toLowerCase();
  if (!name || files.length === 0) return files[0];

  const keywords = CAB_TYPE_TO_KEYWORDS[name] || [name.replace(/\s+/g, '')];
  for (const kw of keywords) {
    const found = files.find((f) => f.toLowerCase().includes(kw.toLowerCase()));
    if (found) return found;
  }
  return files[0];
}

async function main() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    console.error('uploads/car-options directory not found');
    process.exit(1);
  }

  const files = fs.readdirSync(UPLOADS_DIR).filter((f) => !f.startsWith('.'));
  if (files.length === 0) {
    console.error('No image files in uploads/car-options/');
    process.exit(1);
  }

  const cabTypes = await db.allAsync('SELECT id, name FROM cab_types');
  const cabTypeIdToImage = new Map();
  for (const ct of cabTypes || []) {
    const file = pickImageForCabType(ct.name, files);
    cabTypeIdToImage.set(ct.id, `car-options/${file}`);
  }

  const cabs = await db.allAsync(
    'SELECT id, vehicle_number, name, cab_type_id FROM cabs'
  );
  let updated = 0;
  for (const cab of cabs || []) {
    const imagePath = cabTypeIdToImage.get(cab.cab_type_id) || cabTypeIdToImage.values().next().value;
    await db.runAsync('UPDATE cabs SET image_url = ? WHERE id = ?', [imagePath, cab.id]);
    console.log(`Cab ${cab.id} (${cab.vehicle_number}) -> ${imagePath}`);
    updated++;
  }

  console.log(`\nDone. Updated ${updated} cabs with image_url.`);
  if (typeof db.close === 'function') db.close(() => {});
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
