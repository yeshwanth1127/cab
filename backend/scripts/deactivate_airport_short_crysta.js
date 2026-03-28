/**
 * Deactivate legacy airport cab_types row named "Crysta" (keep "Innova Crysta").
 * Run: node backend/scripts/deactivate_airport_short_crysta.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const db = require('../db/database');

async function main() {
  const r = await db.runAsync(
    `UPDATE cab_types SET is_active = 0
     WHERE service_type = 'airport' AND LOWER(TRIM(name)) = 'crysta'`
  );
  console.log('Rows updated:', r.changes ?? r);
  if (typeof db.close === 'function') {
    await new Promise((resolve) => db.close(resolve));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
