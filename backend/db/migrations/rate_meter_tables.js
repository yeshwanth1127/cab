/**
 * Migration: Rate Meter tables and cab_types.service_type
 *
 * - Adds service_type to cab_types and UNIQUE(name, service_type)
 * - Creates rate_meters table
 * - Creates local_package_rates table
 *
 * Run from backend dir: node db/migrations/rate_meter_tables.js
 */

const path = require('path');
try {
  require('dotenv').config({ path: path.join(__dirname, '../../.env') });
} catch (_) {}
const db = require('../database');

async function runMigration() {
  try {
    console.log('Starting migration: Rate Meter tables...');

    // 1. Add service_type to cab_types if not present
    try {
      await db.runAsync('ALTER TABLE cab_types ADD COLUMN service_type TEXT DEFAULT \'local\'');
      console.log('Added service_type to cab_types');
    } catch (e) {
      if (e.message && e.message.includes('duplicate column')) {
        console.log('cab_types.service_type already exists');
      } else throw e;
    }

    // 2. Recreate cab_types with UNIQUE(name, service_type)
    const tableInfo = await db.getAsync(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='cab_types'"
    );
    if (tableInfo) {
      const hasUnique = await db.getAsync(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='cab_types'"
      );
      const sql = (hasUnique && hasUnique.sql) ? hasUnique.sql : '';
      if (sql && sql.includes('UNIQUE(name, service_type)')) {
        console.log('cab_types already has UNIQUE(name, service_type)');
      } else {
        await db.runAsync(`
          CREATE TABLE cab_types_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            base_fare REAL NOT NULL DEFAULT 0,
            per_km_rate REAL NOT NULL DEFAULT 0,
            per_minute_rate REAL DEFAULT 0,
            capacity INTEGER DEFAULT 4,
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            service_type TEXT DEFAULT 'local',
            UNIQUE(name, service_type)
          )
        `);
        await db.runAsync(`
          INSERT INTO cab_types_new (id, name, description, base_fare, per_km_rate, per_minute_rate, capacity, is_active, created_at, service_type)
          SELECT id, name, description, base_fare, per_km_rate, per_minute_rate, capacity, is_active, created_at, COALESCE(service_type, 'local') FROM cab_types
        `);
        await db.runAsync('DROP TABLE cab_types');
        await db.runAsync('ALTER TABLE cab_types_new RENAME TO cab_types');
        console.log('Recreated cab_types with UNIQUE(name, service_type)');
      }
    }

    // 3. Optional: add name, description, image_url to cabs if used by public APIs
    for (const col of [
      ['name', 'TEXT'],
      ['description', 'TEXT'],
      ['image_url', 'TEXT'],
    ]) {
      try {
        await db.runAsync(`ALTER TABLE cabs ADD COLUMN ${col[0]} ${col[1]}`);
        console.log(`Added cabs.${col[0]}`);
      } catch (e) {
        if (e.message && e.message.includes('duplicate column')) {
          // ignore
        } else throw e;
      }
    }

    // 4. Create rate_meters table
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS rate_meters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service_type TEXT NOT NULL,
        car_category TEXT NOT NULL,
        trip_type TEXT,
        base_fare REAL DEFAULT 0,
        per_km_rate REAL DEFAULT 0,
        extra_km_rate REAL DEFAULT 0,
        min_km INTEGER,
        base_km_per_day INTEGER,
        driver_charges REAL DEFAULT 0,
        night_charges REAL DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Created rate_meters table (if not exists)');

    // 5. Create local_package_rates table
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS local_package_rates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cab_type_id INTEGER NOT NULL,
        hours INTEGER NOT NULL,
        package_fare REAL,
        extra_hour_rate REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cab_type_id) REFERENCES cab_types(id) ON DELETE CASCADE,
        UNIQUE(cab_type_id, hours)
      )
    `);
    console.log('Created local_package_rates table (if not exists)');

    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

runMigration()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
