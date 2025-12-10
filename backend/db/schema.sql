-- SQLite Database Schema for Cab Booking System
-- 
-- ⚠️  CRITICAL: DO NOT ADD DELETE, DROP, or TRUNCATE STATEMENTS TO THIS FILE!
-- This file is executed on every database initialization.
-- Any DELETE/DROP/TRUNCATE statements will be automatically blocked by the database.js safeguard,
-- but it's better to never add them in the first place.
-- 
-- Use INSERT OR IGNORE for adding default data.
-- Use CREATE TABLE IF NOT EXISTS for creating tables.
-- Use ALTER TABLE with error handling for migrations.

-- Users table (for admin and potentially regular users)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Cab types table
CREATE TABLE IF NOT EXISTS cab_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    base_fare REAL NOT NULL,
    per_km_rate REAL NOT NULL,
    per_minute_rate REAL DEFAULT 0,
    capacity INTEGER DEFAULT 4,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Cabs table (individual vehicles)
CREATE TABLE IF NOT EXISTS cabs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cab_type_id INTEGER,
    vehicle_number TEXT UNIQUE NOT NULL,
    driver_name TEXT,
    driver_phone TEXT,
    is_available INTEGER DEFAULT 1,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cab_type_id) REFERENCES cab_types(id) ON DELETE SET NULL
);

-- Routes table (popular routes with fixed fares)
CREATE TABLE IF NOT EXISTS routes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_location TEXT NOT NULL,
    to_location TEXT NOT NULL,
    distance_km REAL NOT NULL,
    estimated_time_minutes INTEGER,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    cab_id INTEGER,
    cab_type_id INTEGER,
    car_option_id INTEGER,
    from_location TEXT NOT NULL,
    to_location TEXT NOT NULL,
    distance_km REAL NOT NULL,
    estimated_time_minutes INTEGER,
    fare_amount REAL NOT NULL,
    booking_status TEXT DEFAULT 'pending' CHECK (booking_status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled')),
    booking_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    travel_date DATETIME,
    passenger_name TEXT,
    passenger_phone TEXT,
    passenger_email TEXT,
    notes TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (cab_id) REFERENCES cabs(id) ON DELETE SET NULL,
    FOREIGN KEY (cab_type_id) REFERENCES cab_types(id) ON DELETE SET NULL,
    FOREIGN KEY (car_option_id) REFERENCES car_options(id) ON DELETE SET NULL
);

-- Car options table (for marketing / info cards)
CREATE TABLE IF NOT EXISTS car_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    is_active INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Corporate companies table
CREATE TABLE IF NOT EXISTS corporate_companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    domain TEXT,
    contact_name TEXT NOT NULL,
    contact_email TEXT NOT NULL,
    contact_phone TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'disabled')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(contact_email)
);

-- Corporate HR/auth users
CREATE TABLE IF NOT EXISTS corporate_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'corporate_hr' CHECK (role IN ('corporate_hr')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, email),
    FOREIGN KEY (company_id) REFERENCES corporate_companies(id) ON DELETE CASCADE
);

-- Employee intake records
CREATE TABLE IF NOT EXISTS corporate_employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    pickup_location TEXT,
    drop_location TEXT,
    shift_start TEXT,
    shift_end TEXT,
    notes TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'assigned', 'inactive')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, email),
    FOREIGN KEY (company_id) REFERENCES corporate_companies(id) ON DELETE CASCADE
);

-- Intake links generated for employees
CREATE TABLE IF NOT EXISTS corporate_intake_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at DATETIME,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'used')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES corporate_companies(id) ON DELETE CASCADE
);

-- Vehicle assignments for corporate employees
CREATE TABLE IF NOT EXISTS corporate_vehicle_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    cab_id INTEGER,
    vehicle_label TEXT,
    route_info TEXT,
    pickup_time TEXT,
    status TEXT DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_progress', 'completed', 'cancelled')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES corporate_employees(id) ON DELETE CASCADE,
    FOREIGN KEY (cab_id) REFERENCES cabs(id) ON DELETE SET NULL,
    UNIQUE(employee_id)
);

-- Corporate bookings table (public form submissions)
CREATE TABLE IF NOT EXISTS corporate_bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    company_name TEXT NOT NULL,
    pickup_point TEXT NOT NULL,
    drop_point TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled')),
    notes TEXT,
    cab_id INTEGER,
    driver_name TEXT,
    driver_phone TEXT,
    assigned_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cab_id) REFERENCES cabs(id) ON DELETE SET NULL
);

-- Insert default service-type cab types (only if they don't exist)
INSERT OR IGNORE INTO cab_types (name, description, base_fare, per_km_rate, per_minute_rate, capacity) VALUES
('Local', 'Local city rides', 50.00, 10.00, 1.00, 4),
('Airport', 'Airport pick-up and drop', 80.00, 12.00, 1.20, 4),
('Outstation', 'Outstation / intercity trips', 100.00, 15.00, 1.50, 4);
