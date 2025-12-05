const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

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

// Initialize database with schema
const initDatabase = () => {
  return new Promise(async (resolve, reject) => {
    try {
      const schemaPath = path.join(__dirname, 'schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf8');
      
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
              await db.runAsync(
                `INSERT INTO car_options (name, description, image_url, sort_order)
                 SELECT ?, ?, NULL, ?
                 WHERE NOT EXISTS (SELECT 1 FROM car_options WHERE name = ?)`,
                [name, description, sortOrder, name]
              );
            }

            console.log('Seeded car_options table with predefined cars (if missing)');
          } catch (seedErr) {
            console.error('Error seeding car_options table:', seedErr.message);
          }

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

// Initialize on module load
initDatabase().catch(console.error);

module.exports = db;

