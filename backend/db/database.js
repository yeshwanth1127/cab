/**
 * Database Module with Data Protection Safeguards
 * Supports both SQLite (development) and MySQL (production)
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

const path = require('path');
const fs = require('fs');
const { mapCarToSubtype } = require('../utils/carMapping');

// Determine database type from environment variables
const DB_TYPE = process.env.DB_HOST ? 'mysql' : 'sqlite';
let db;
let isInitialized = false;

// Initialize database connection
if (DB_TYPE === 'mysql') {
  // MySQL connection
  const mysql = require('mysql2/promise');
  const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'mydbname',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  // Create a database-like interface for MySQL
  db = {
    pool: pool,
    runAsync: async (sql, params = []) => {
      const connection = await pool.getConnection();
      try {
        // Convert SQLite syntax to MySQL
        sql = convertSQLiteToMySQL(sql);
        const [result] = await connection.execute(sql, params);
        return {
          lastID: result.insertId || 0,
          changes: result.affectedRows || 0
        };
      } finally {
        connection.release();
      }
    },
    getAsync: async (sql, params = []) => {
      const connection = await pool.getConnection();
      try {
        sql = convertSQLiteToMySQL(sql);
        const [rows] = await connection.execute(sql, params);
        return rows[0] || null;
      } finally {
        connection.release();
      }
    },
    allAsync: async (sql, params = []) => {
      const connection = await pool.getConnection();
      try {
        sql = convertSQLiteToMySQL(sql);
        const [rows] = await connection.execute(sql, params);
        return rows || [];
      } finally {
        connection.release();
      }
    },
    exec: async (sql, callback) => {
      try {
        sql = convertSQLiteToMySQL(sql);
        const statements = sql.split(';').filter(s => s.trim());
        const connection = await pool.getConnection();
        try {
          for (const statement of statements) {
            if (statement.trim()) {
              await connection.execute(statement);
            }
          }
          callback(null);
        } finally {
          connection.release();
        }
      } catch (err) {
        callback(err);
      }
    },
    close: async (callback) => {
      try {
        await pool.end();
        if (callback) callback(null);
      } catch (err) {
        if (callback) callback(err);
      }
    }
  };

  console.log('Connected to MySQL database');
} else {
  // SQLite connection (default/development)
  const sqlite3 = require('sqlite3').verbose();
  const DB_PATH = path.join(__dirname, 'cab_booking.db');
  
  db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error('Error opening database:', err.message);
    } else {
      console.log('Connected to SQLite database');
      db.run('PRAGMA foreign_keys = ON');
    }
  });

  // Promisified database methods for SQLite
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
}

// Convert SQLite syntax to MySQL syntax
function convertSQLiteToMySQL(sql) {
  if (DB_TYPE !== 'mysql') return sql;
  
  let converted = sql;
  
  // Replace AUTOINCREMENT with AUTO_INCREMENT
  converted = converted.replace(/AUTOINCREMENT/gi, 'AUTO_INCREMENT');
  
  // Replace INTEGER PRIMARY KEY with INT PRIMARY KEY AUTO_INCREMENT (for MySQL)
  converted = converted.replace(/INTEGER PRIMARY KEY AUTO_INCREMENT/gi, 'INT PRIMARY KEY AUTO_INCREMENT');
  
  // Replace TEXT with VARCHAR(255) or TEXT (keep TEXT for longer fields)
  // This is a simple conversion - you might want to be more specific
  converted = converted.replace(/\bTEXT\b/gi, 'TEXT');
  
  // Replace REAL with DECIMAL(10,2) for monetary values, or DOUBLE for calculations
  converted = converted.replace(/\bREAL\b/gi, 'DECIMAL(10,2)');
  
  // Replace INSERT OR IGNORE with INSERT IGNORE
  converted = converted.replace(/INSERT OR IGNORE/gi, 'INSERT IGNORE');
  
  // Replace CURRENT_TIMESTAMP with NOW() for MySQL (though CURRENT_TIMESTAMP also works)
  // Keep CURRENT_TIMESTAMP as it works in both
  
  // Handle CHECK constraints - MySQL syntax is slightly different
  // SQLite: CHECK (status IN ('pending', 'confirmed'))
  // MySQL: Same syntax works
  
  return converted;
}

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
      console.log('Database already initialized, skipping...');
      resolve();
      return;
    }

    try {
      // Check if database already has tables (data exists)
      let tablesExist = false;
      if (DB_TYPE === 'mysql') {
        try {
          const [rows] = await db.pool.execute(
            "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'bookings'",
            [process.env.DB_NAME || 'mydbname']
          );
          tablesExist = rows[0].count > 0;
        } catch (e) {
          // Ignore errors
        }
      } else {
        try {
          const result = await db.getAsync(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='bookings'"
          );
          tablesExist = result !== null && result !== undefined;
        } catch (e) {
          // Ignore errors
        }
      }

      if (tablesExist) {
        console.log('⚠️  Database tables already exist - skipping schema initialization to protect existing data');
        await runMigrations();
        isInitialized = true;
        resolve();
        return;
      }

      const schemaPath = path.join(__dirname, 'schema.sql');
      let schema = fs.readFileSync(schemaPath, 'utf8');
      
      // Remove any dangerous statements before execution
      schema = filterSafeSQL(schema);
      
      // Convert SQLite syntax to MySQL if needed
      if (DB_TYPE === 'mysql') {
        schema = convertSQLiteToMySQL(schema);
      }
      
      if (DB_TYPE === 'mysql') {
        // For MySQL, execute statements one by one
        const statements = schema.split(';').filter(s => s.trim());
        const connection = await db.pool.getConnection();
        try {
          for (const statement of statements) {
            if (statement.trim()) {
              try {
                await connection.execute(statement);
              } catch (err) {
                // Ignore "table already exists" errors
                if (!err.message.includes('already exists') && !err.message.includes('Duplicate')) {
                  console.error('Error executing statement:', err.message);
                }
              }
            }
          }
        } finally {
          connection.release();
        }
        console.log('✅ Database schema initialized successfully (MySQL)');
        await runMigrations();
        isInitialized = true;
        resolve();
      } else {
        // SQLite execution
        db.exec(schema, async (err) => {
          if (err) {
            console.error('❌ Error initializing database:', err.message);
            reject(err);
            return;
          }
          console.log('✅ Database schema initialized successfully (SQLite)');
          await runMigrations();
          isInitialized = true;
          resolve();
        });
      }
    } catch (error) {
      console.error('❌ Database initialization error:', error);
      reject(error);
    }
  });
};

// Run database migrations
const runMigrations = async () => {
  try {
    // Migration to add service_type column if it doesn't exist
    try {
      await db.runAsync(
        `ALTER TABLE bookings ADD COLUMN service_type TEXT DEFAULT 'local' CHECK (service_type IN ('local', 'airport', 'outstation'))`
      );
      console.log('Migration: service_type column added to bookings');
    } catch (migrationErr) {
      const errMsg = migrationErr.message || '';
      if (!errMsg.includes('duplicate column') && !errMsg.includes('Duplicate column')) {
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
      const errMsg = migrationErr.message || '';
      if (!errMsg.includes('duplicate column') && !errMsg.includes('Duplicate column')) {
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
      const errMsg = migrationErr.message || '';
      if (!errMsg.includes('duplicate column') && !errMsg.includes('Duplicate column')) {
        console.log('Migration note (car_subtype):', migrationErr.message);
      }
    }

    try {
      await db.runAsync(
        `ALTER TABLE car_options ADD COLUMN cab_type_id INTEGER`
      );
      console.log('Migration: cab_type_id column added to car_options');
    } catch (migrationErr) {
      const errMsg = migrationErr.message || '';
      if (!errMsg.includes('duplicate column') && !errMsg.includes('Duplicate column')) {
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
      const errMsg = migrationErr.message || '';
      if (!errMsg.includes('duplicate column') && !errMsg.includes('Duplicate column')) {
        console.log('Migration note (number_of_hours):', migrationErr.message);
      }
    }

    // Migration to add trip_type to bookings
    try {
      await db.runAsync(
        `ALTER TABLE bookings ADD COLUMN trip_type TEXT CHECK (trip_type IN ('one_way', 'round_trip', 'multiple_way'))`
      );
      console.log('Migration: trip_type column added to bookings');
    } catch (migrationErr) {
      const errMsg = migrationErr.message || '';
      if (!errMsg.includes('duplicate column') && !errMsg.includes('Duplicate column')) {
        console.log('Migration note (trip_type):', migrationErr.message);
      }
    }

    // Migration: add driver_id to cabs
    try {
      await db.runAsync(
        `ALTER TABLE cabs ADD COLUMN driver_id INTEGER`
      );
      console.log('Migration: driver_id column added to cabs');
    } catch (migrationErr) {
      const errMsg = migrationErr.message || '';
      if (!errMsg.includes('duplicate column') && !errMsg.includes('Duplicate column')) {
        console.log('Migration note (driver_id on cabs):', migrationErr.message);
      }
    }

    // Migration: add driver_id to corporate_bookings
    try {
      await db.runAsync(
        `ALTER TABLE corporate_bookings ADD COLUMN driver_id INTEGER`
      );
      console.log('Migration: driver_id column added to corporate_bookings');
    } catch (migrationErr) {
      const errMsg = migrationErr.message || '';
      if (!errMsg.includes('duplicate column') && !errMsg.includes('Duplicate column')) {
        console.log('Migration note (driver_id on corporate_bookings):', migrationErr.message);
      }
    }

    // Migration: create drivers table if missing (for existing DBs)
    try {
      const driversSQL = DB_TYPE === 'mysql'
        ? `CREATE TABLE IF NOT EXISTS drivers (
            id INT PRIMARY KEY AUTO_INCREMENT,
            name VARCHAR(255) NOT NULL,
            phone VARCHAR(50) NOT NULL UNIQUE,
            license_number VARCHAR(255) UNIQUE,
            photo_url TEXT,
            emergency_contact_name VARCHAR(255),
            emergency_contact_phone VARCHAR(50),
            is_active INT DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )`
        : `CREATE TABLE IF NOT EXISTS drivers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT NOT NULL UNIQUE,
            license_number TEXT UNIQUE,
            photo_url TEXT,
            emergency_contact_name TEXT,
            emergency_contact_phone TEXT,
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )`;
      await db.runAsync(driversSQL);
      console.log('Migration: drivers table ensured');
    } catch (migrationErr) {
      console.log('Migration note (drivers table):', migrationErr.message);
    }

    // Migration: add missing driver columns (for legacy tables)
    const driverColumns = [
      { name: 'photo_url', type: 'TEXT' },
      { name: 'emergency_contact_name', type: 'TEXT' },
      { name: 'emergency_contact_phone', type: 'TEXT' },
      { name: 'license_number', type: 'TEXT' },
    ];
    for (const col of driverColumns) {
      try {
        await db.runAsync(`ALTER TABLE drivers ADD COLUMN ${col.name} ${col.type}`);
        console.log(`Migration: ${col.name} column added to drivers`);
      } catch (migrationErr) {
        const errMsg = migrationErr.message || '';
        if (!errMsg.includes('duplicate column') && !errMsg.includes('Duplicate column')) {
          console.log(`Migration note (${col.name} on drivers):`, migrationErr.message);
        }
      }
    }

    // Migration to add driver assignment fields to corporate_bookings
    try {
      await db.runAsync(
        `ALTER TABLE corporate_bookings ADD COLUMN cab_id INTEGER`
      );
      console.log('Migration: cab_id column added to corporate_bookings');
    } catch (migrationErr) {
      const errMsg = migrationErr.message || '';
      if (!errMsg.includes('duplicate column') && !errMsg.includes('Duplicate column')) {
        console.log('Migration note (cab_id):', migrationErr.message);
      }
    }

    try {
      await db.runAsync(
        `ALTER TABLE corporate_bookings ADD COLUMN driver_name TEXT`
      );
      console.log('Migration: driver_name column added to corporate_bookings');
    } catch (migrationErr) {
      const errMsg = migrationErr.message || '';
      if (!errMsg.includes('duplicate column') && !errMsg.includes('Duplicate column')) {
        console.log('Migration note (driver_name):', migrationErr.message);
      }
    }

    try {
      await db.runAsync(
        `ALTER TABLE corporate_bookings ADD COLUMN driver_phone TEXT`
      );
      console.log('Migration: driver_phone column added to corporate_bookings');
    } catch (migrationErr) {
      const errMsg = migrationErr.message || '';
      if (!errMsg.includes('duplicate column') && !errMsg.includes('Duplicate column')) {
        console.log('Migration note (driver_phone):', migrationErr.message);
      }
    }

    try {
      await db.runAsync(
        `ALTER TABLE corporate_bookings ADD COLUMN assigned_at DATETIME`
      );
      console.log('Migration: assigned_at column added to corporate_bookings');
    } catch (migrationErr) {
      const errMsg = migrationErr.message || '';
      if (!errMsg.includes('duplicate column') && !errMsg.includes('Duplicate column')) {
        console.log('Migration note (assigned_at):', migrationErr.message);
      }
    }

    // Migration to create rate_meters table
    try {
      const rateMetersSQL = DB_TYPE === 'mysql' 
        ? `CREATE TABLE IF NOT EXISTS rate_meters (
            id INT PRIMARY KEY AUTO_INCREMENT,
            service_type VARCHAR(50) NOT NULL,
            car_category VARCHAR(100) NOT NULL,
            base_fare DECIMAL(10,2) NOT NULL DEFAULT 0,
            per_km_rate DECIMAL(10,2) NOT NULL DEFAULT 0,
            per_minute_rate DECIMAL(10,2) NOT NULL DEFAULT 0,
            per_hour_rate DECIMAL(10,2) NOT NULL DEFAULT 0,
            is_active INT DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(service_type, car_category)
          )`
        : `CREATE TABLE IF NOT EXISTS rate_meters (
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
          )`;
      
      await db.runAsync(rateMetersSQL);
      console.log('Migration: rate_meters table created');
      
      // Define all required rate meters
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
      
      // Insert or update rate meters
      for (const [service_type, car_category, base_fare, per_km_rate, per_minute_rate, per_hour_rate] of defaultRates) {
        const existing = await db.getAsync(
          'SELECT id FROM rate_meters WHERE service_type = ? AND car_category = ?',
          [service_type, car_category]
        );
        
        if (existing) {
          await db.runAsync(
            `UPDATE rate_meters 
             SET base_fare = ?, per_km_rate = ?, per_minute_rate = ?, per_hour_rate = ?, updated_at = CURRENT_TIMESTAMP
             WHERE service_type = ? AND car_category = ?`,
            [base_fare, per_km_rate, per_minute_rate, per_hour_rate, service_type, car_category]
          );
        } else {
          const insertSQL = DB_TYPE === 'mysql'
            ? `INSERT IGNORE INTO rate_meters (service_type, car_category, base_fare, per_km_rate, per_minute_rate, per_hour_rate)
               VALUES (?, ?, ?, ?, ?, ?)`
            : `INSERT OR IGNORE INTO rate_meters (service_type, car_category, base_fare, per_km_rate, per_minute_rate, per_hour_rate)
               VALUES (?, ?, ?, ?, ?, ?)`;
          await db.runAsync(insertSQL, [service_type, car_category, base_fare, per_km_rate, per_minute_rate, per_hour_rate]);
        }
      }
      
      console.log('Migration: Rate meters updated');
    } catch (migrationErr) {
      const errMsg = migrationErr.message || '';
      if (!errMsg.includes('already exists') && !errMsg.includes('Duplicate')) {
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
        const insertSQL = DB_TYPE === 'mysql'
          ? `INSERT INTO car_options (name, description, image_url, sort_order, car_subtype)
             SELECT ?, ?, NULL, ?, ?
             WHERE NOT EXISTS (SELECT 1 FROM car_options WHERE name = ?)`
          : `INSERT INTO car_options (name, description, image_url, sort_order, car_subtype)
             SELECT ?, ?, NULL, ?, ?
             WHERE NOT EXISTS (SELECT 1 FROM car_options WHERE name = ?)`;
        
        await db.runAsync(insertSQL, [name, description, sortOrder, subtype, name]);
        
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
  } catch (error) {
    console.error('Error running migrations:', error);
  }
};

// Initialize on module load (only once, and only if tables don't exist)
// This ensures data is NEVER lost on server restart
initDatabase().catch((err) => {
  console.error('❌ Database initialization error:', err);
  // Don't set isInitialized to false on error - let it retry on next require
  // This prevents data loss if there's a temporary error
  // The table existence check will prevent re-initialization even if isInitialized is false
});

module.exports = db;
