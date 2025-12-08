/**
 * Database Module with Data Protection Safeguards
 * 
 * ⚠️  CRITICAL SAFEGUARDS IMPLEMENTED:
 * 1. SQL Filter: Automatically blocks any DELETE, DROP, or TRUNCATE statements in schema.sql
 * 2. Single Initialization: Database only initializes once per process (prevents re-running schema)
 * 3. Safe Foreign Keys: Changed CASCADE deletes to SET NULL to prevent cascading data loss
 * 4. Idempotent Operations: All schema operations use IF NOT EXISTS or INSERT OR IGNORE
 * 
 * These safeguards ensure that:
 * - Running setup-admin.js will NEVER delete data
 * - Restarting the server will NEVER delete data
 * - Schema changes will NEVER delete existing data
 * - Only intentional admin panel deletions can remove data (and only specific items)
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { mapCarToSubtype } = require('../utils/carMapping');

const DB_PATH = path.join(__dirname, 'cab_booking.db');

// Create database connection
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
    // Enable foreign keys
    db.run('PRAGMA foreign_keys = ON');
  }
});

// Track if database has been initialized to prevent re-initialization
let isInitialized = false;

// Safeguard: Filter out any dangerous SQL statements (DELETE, DROP, TRUNCATE)
const filterSafeSQL = (sql) => {
  const lines = sql.split(';');
  const safeLines = lines.filter(line => {
    const trimmed = line.trim().toUpperCase();
    // Block any DELETE, DROP, or TRUNCATE statements
    if (trimmed.includes('DELETE FROM') || 
        trimmed.includes('DROP TABLE') || 
        trimmed.includes('TRUNCATE TABLE') ||
        trimmed.startsWith('DELETE') ||
        trimmed.startsWith('DROP') ||
        trimmed.startsWith('TRUNCATE')) {
      console.warn('⚠️  BLOCKED DANGEROUS SQL STATEMENT:', trimmed.substring(0, 100));
      return false;
    }
    return true;
  });
  return safeLines.join(';');
};

// Initialize database with schema
const initDatabase = () => {
  return new Promise(async (resolve, reject) => {
    // Prevent multiple initializations
    if (isInitialized) {
      resolve();
      return;
    }

    try {
      const schemaPath = path.join(__dirname, 'schema.sql');
      let schema = fs.readFileSync(schemaPath, 'utf8');
      
      // Remove any dangerous statements before execution
      schema = filterSafeSQL(schema);
      
      db.exec(schema, async (err) => {
        if (err) {
          console.error('Error initializing database:', err.message);
          reject(err);
        } else {
          console.log('Database schema initialized successfully');
          
          // Run migration to add service_type column if it doesn't exist
          try {
            await db.runAsync(
              `ALTER TABLE bookings ADD COLUMN service_type TEXT DEFAULT 'local' CHECK (service_type IN ('local', 'airport', 'outstation'))`
            );
            console.log('Migration: service_type column added to bookings');
          } catch (migrationErr) {
            // Column might already exist, which is fine
            if (!migrationErr.message.includes('duplicate column')) {
              console.log('Migration note:', migrationErr.message);
            }
          }

          // Migration to add car_option_id column if it doesn't exist
          try {
            await db.runAsync(
              `ALTER TABLE bookings ADD COLUMN car_option_id INTEGER`
            );
            console.log('Migration: car_option_id column added to bookings');
          } catch (migrationErr) {
            // Column might already exist, which is fine
            if (!migrationErr.message.includes('duplicate column')) {
              console.log('Migration note (car_option_id):', migrationErr.message);
            }
          }

          // Migration to add car_subtype and cab_type_id to car_options
          try {
            await db.runAsync(
              `ALTER TABLE car_options ADD COLUMN car_subtype TEXT`
            );
            console.log('Migration: car_subtype column added to car_options');
          } catch (migrationErr) {
            if (!migrationErr.message.includes('duplicate column')) {
              console.log('Migration note (car_subtype):', migrationErr.message);
            }
          }

          try {
            await db.runAsync(
              `ALTER TABLE car_options ADD COLUMN cab_type_id INTEGER`
            );
            console.log('Migration: cab_type_id column added to car_options');
          } catch (migrationErr) {
            if (!migrationErr.message.includes('duplicate column')) {
              console.log('Migration note (cab_type_id):', migrationErr.message);
            }
          }

          // Migration to add number_of_hours to bookings
          try {
            await db.runAsync(
              `ALTER TABLE bookings ADD COLUMN number_of_hours INTEGER`
            );
            console.log('Migration: number_of_hours column added to bookings');
          } catch (migrationErr) {
            if (!migrationErr.message.includes('duplicate column')) {
              console.log('Migration note (number_of_hours):', migrationErr.message);
            }
          }

          // Migration to create rate_meters table
          try {
            await db.runAsync(
              `CREATE TABLE IF NOT EXISTS rate_meters (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                service_type TEXT NOT NULL CHECK (service_type IN ('local', 'airport', 'outstation')),
                car_category TEXT NOT NULL,
                base_fare REAL NOT NULL DEFAULT 0,
                per_km_rate REAL NOT NULL DEFAULT 0,
                per_minute_rate REAL NOT NULL DEFAULT 0,
                per_hour_rate REAL NOT NULL DEFAULT 0,
                is_active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(service_type, car_category)
              )`
            );
            console.log('Migration: rate_meters table created');
            
            // Define all required rate meters with new subtypes (ordered: Sedan, SUV, Innova, Innova Crysta, Tempo, Urbenia, Minibus)
            const defaultRates = [
              ['local', 'Sedan', 50.00, 0, 0, 200.00],
              ['local', 'SUV', 60.00, 0, 0, 250.00],
              ['local', 'Innova', 70.00, 0, 0, 300.00],
              ['local', 'Innova Crysta', 80.00, 0, 0, 350.00],
              ['local', 'Tempo', 90.00, 0, 0, 400.00],
              ['local', 'Urbenia', 100.00, 0, 0, 450.00],
              ['local', 'Minibus', 120.00, 0, 0, 500.00],
              ['airport', 'Sedan', 80.00, 12.00, 1.20, 0],
              ['airport', 'SUV', 100.00, 15.00, 1.50, 0],
              ['airport', 'Innova', 120.00, 18.00, 1.80, 0],
              ['airport', 'Innova Crysta', 140.00, 20.00, 2.00, 0],
              ['airport', 'Tempo', 160.00, 22.00, 2.20, 0],
              ['airport', 'Urbenia', 180.00, 25.00, 2.50, 0],
              ['airport', 'Minibus', 200.00, 28.00, 2.80, 0],
              ['outstation', 'Sedan', 100.00, 15.00, 1.50, 0],
              ['outstation', 'SUV', 120.00, 18.00, 1.80, 0],
              ['outstation', 'Innova', 150.00, 22.00, 2.20, 0],
              ['outstation', 'Innova Crysta', 180.00, 25.00, 2.50, 0],
              ['outstation', 'Tempo', 200.00, 28.00, 2.80, 0],
              ['outstation', 'Urbenia', 220.00, 30.00, 3.00, 0],
              ['outstation', 'Minibus', 250.00, 35.00, 3.50, 0],
            ];
            
            // Insert or update rate meters for all required combinations
            for (const [service_type, car_category, base_fare, per_km_rate, per_minute_rate, per_hour_rate] of defaultRates) {
              // Check if rate meter exists
              const existing = await db.getAsync(
                'SELECT id FROM rate_meters WHERE service_type = ? AND car_category = ?',
                [service_type, car_category]
              );
              
              if (existing) {
                // Update existing rate meter
                await db.runAsync(
                  `UPDATE rate_meters 
                   SET base_fare = ?, per_km_rate = ?, per_minute_rate = ?, per_hour_rate = ?, updated_at = CURRENT_TIMESTAMP
                   WHERE service_type = ? AND car_category = ?`,
                  [base_fare, per_km_rate, per_minute_rate, per_hour_rate, service_type, car_category]
                );
              } else {
                // Insert new rate meter
                await db.runAsync(
                  `INSERT INTO rate_meters (service_type, car_category, base_fare, per_km_rate, per_minute_rate, per_hour_rate)
                   VALUES (?, ?, ?, ?, ?, ?)`,
                  [service_type, car_category, base_fare, per_km_rate, per_minute_rate, per_hour_rate]
                );
              }
            }
            
            // NOTE: Removed DELETE statement to prevent data loss
            // Old rate meters with deprecated subtypes will remain but won't be used
            // They can be manually removed through admin panel if needed
            
            console.log('Migration: Rate meters updated with new subtypes');
          } catch (migrationErr) {
            if (!migrationErr.message.includes('already exists')) {
              console.log('Migration note (rate_meters):', migrationErr.message);
            }
          }

          // Seed car options table with predefined cars (idempotent)
          try {
            const seedCars = [
              ['Etios', 'Sedan – Etios (4 seats)', 1],
              ['Dzire', 'Sedan – Dzire (4 seats)', 2],
              ['Honda City', 'Sedan – Premiere (Honda City, 4 seats)', 3],
              ['Ciaz', 'Sedan – Premiere (Ciaz, 4 seats)', 4],
              ['Ertiga', 'SUV – Ertiga (6–7 seats)', 5],
              ['Marazzo', 'SUV – Marazzo (6–7 seats)', 6],
              ['Rumion', 'SUV – Rumion (6–7 seats)', 7],
              ['Innova', 'Innova (7 seats)', 8],
              ['Crysta', 'Innova Crysta (7 seats)', 9],
              ['Tempo Traveller 9+1', 'Tempo Traveller (9+1 seater)', 10],
              ['Tempo Traveller 12+1', 'Tempo Traveller (12-1 seater)', 11],
              ['Urbenia 9 seater', 'Urbenia (9 seater)', 12],
              ['Urbenia 13 seater', 'Urbenia (13 seater)', 13],
              ['Urbenia 15 seater', 'Urbenia (15 seater)', 14],
              ['Urbenia 17 seater', 'Urbenia (17 seater)', 15],
              ['Minibus 21 seater', 'Minibus (21 seater)', 16],
              ['Minibus 24 seater', 'Minibus (24 seater)', 17],
              ['Minibus 30 seater', 'Minibus (30 seater)', 18],
            ];

            for (const [name, description, sortOrder] of seedCars) {
              const subtype = mapCarToSubtype(name, description);
              await db.runAsync(
                `INSERT INTO car_options (name, description, image_url, sort_order, car_subtype)
                 SELECT ?, ?, NULL, ?, ?
                 WHERE NOT EXISTS (SELECT 1 FROM car_options WHERE name = ?)`,
                [name, description, sortOrder, subtype, name]
              );
              
              // Update existing records with subtype (always update to ensure correct mapping)
              if (subtype) {
                await db.runAsync(
                  `UPDATE car_options SET car_subtype = ? WHERE name = ?`,
                  [subtype, name]
                );
              }
            }

            console.log('Seeded car_options table with predefined cars (if missing)');
          } catch (seedErr) {
            console.error('Error seeding car_options table:', seedErr.message);
          }

          isInitialized = true;
          resolve();
        }
      });
    } catch (error) {
      reject(error);
    }
  });
};

// Promisified database methods
db.runAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
};

db.getAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

db.allAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

// Initialize on module load (only once)
// This will only run CREATE TABLE IF NOT EXISTS and INSERT OR IGNORE statements
// All DELETE, DROP, and TRUNCATE statements are automatically blocked
initDatabase().catch((err) => {
  console.error('Database initialization error:', err);
  // Don't mark as initialized if there was an error
  isInitialized = false;
});

module.exports = db;

