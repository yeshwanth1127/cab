/**
 * Idempotent: inserts missing cab_types rows for admin Rate Meter defaults.
 * Run: node backend/scripts/ensure_rate_meter_cab_types.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const db = require('../db/database');

const DEFAULTS = [
  { name: 'Sedan', description: 'Sedan cars', service_type: 'local', capacity: 4 },
  { name: 'SUV', description: 'SUV cars', service_type: 'local', capacity: 6 },
  { name: 'Innova Crysta', description: 'Innova Crysta', service_type: 'local', capacity: 6 },
  { name: 'Sedan', description: 'Sedan cars', service_type: 'airport', capacity: 4 },
  { name: 'SUV', description: 'SUV cars', service_type: 'airport', capacity: 6 },
  { name: 'Innova Crysta', description: 'Innova Crysta', service_type: 'airport', capacity: 6 },
  { name: 'Sedan', description: 'Sedan cars', service_type: 'outstation', capacity: 4 },
  { name: 'SUV', description: 'SUV cars', service_type: 'outstation', capacity: 6 },
  { name: 'Innova Crysta', description: 'Innova Crysta', service_type: 'outstation', capacity: 6 },
  { name: 'TT', description: 'Tempo Traveller', service_type: 'outstation', capacity: 12 },
  { name: 'Minibus', description: 'Minibus', service_type: 'outstation', capacity: 14 },
];

async function main() {
  for (const row of DEFAULTS) {
    const existing = await db.getAsync(
      'SELECT id FROM cab_types WHERE name = ? AND service_type = ?',
      [row.name, row.service_type]
    );
    if (existing) continue;
    await db.runAsync(
      `INSERT INTO cab_types (name, description, service_type, base_fare, per_km_rate, capacity, is_active)
       VALUES (?, ?, ?, 0, 0, ?, 1)`,
      [row.name, row.description, row.service_type, row.capacity]
    );
    console.log('Created cab_type:', row.service_type, row.name);
  }
  console.log('Done.');
  if (typeof db.close === 'function') {
    await new Promise((resolve) => db.close(resolve));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
