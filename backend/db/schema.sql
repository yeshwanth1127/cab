CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'manager')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cab_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    service_type TEXT DEFAULT 'local' CHECK (service_type IN ('local', 'airport', 'outstation')),
    base_fare REAL NOT NULL DEFAULT 0,
    per_km_rate REAL NOT NULL DEFAULT 0,
    per_minute_rate REAL DEFAULT 0,
    capacity INTEGER DEFAULT 4,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, service_type)
);

CREATE TABLE IF NOT EXISTS cabs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cab_type_id INTEGER,
    vehicle_number TEXT UNIQUE NOT NULL,
    driver_name TEXT,
    driver_phone TEXT,
    driver_email TEXT,
    driver_id INTEGER,
    name TEXT,
    description TEXT,
    image_url TEXT,
    is_available INTEGER DEFAULT 1,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cab_type_id) REFERENCES cab_types(id) ON DELETE SET NULL,
    FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL
);

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
);

CREATE TABLE IF NOT EXISTS local_package_rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cab_type_id INTEGER NOT NULL,
    hours INTEGER NOT NULL,
    package_fare REAL,
    extra_hour_rate REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cab_type_id) REFERENCES cab_types(id) ON DELETE CASCADE,
    UNIQUE(cab_type_id, hours)
);

CREATE TABLE IF NOT EXISTS drivers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    license_number TEXT,
    photo_url TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(phone),
    UNIQUE(license_number)
);

CREATE TABLE IF NOT EXISTS routes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_location TEXT NOT NULL,
    to_location TEXT NOT NULL,
    distance_km REAL NOT NULL,
    estimated_time_minutes INTEGER,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE IF NOT EXISTS car_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cab_type_id INTEGER,
    name TEXT NOT NULL,
    description TEXT,
    car_subtype TEXT,
    image_url TEXT,
    is_active INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cab_type_id) REFERENCES cab_types(id) ON DELETE CASCADE
);

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

CREATE TABLE IF NOT EXISTS corporate_intake_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at DATETIME,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'used')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES corporate_companies(id) ON DELETE CASCADE
);

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

CREATE TABLE IF NOT EXISTS manager_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    section_key TEXT NOT NULL,
    can_view INTEGER DEFAULT 0,
    can_edit INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, section_key),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS event_bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    event_type TEXT NOT NULL,
    pickup_point TEXT NOT NULL,
    drop_point TEXT NOT NULL,
    pickup_date TEXT NOT NULL,
    pickup_time TEXT NOT NULL,
    notes TEXT,
    pickup_lat REAL,
    pickup_lng REAL,
    drop_lat REAL,
    drop_lng REAL,
    number_of_cars INTEGER DEFAULT 1,
    status TEXT DEFAULT 'pending',
    assigned_at DATETIME,
    cab_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cab_id) REFERENCES cabs(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS event_booking_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_booking_id INTEGER NOT NULL,
    cab_id INTEGER,
    driver_id INTEGER,
    driver_name TEXT,
    driver_phone TEXT,
    FOREIGN KEY (event_booking_id) REFERENCES event_bookings(id) ON DELETE CASCADE,
    FOREIGN KEY (cab_id) REFERENCES cabs(id) ON DELETE SET NULL,
    FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL
);

INSERT OR IGNORE INTO cab_types (name, description, service_type, base_fare, per_km_rate, per_minute_rate, capacity) VALUES
('Sedan', 'Sedan cars', 'local', 0, 0, 0, 4),
('SUV', 'SUV cars', 'local', 0, 0, 0, 6),
('Innova Crysta', 'Innova Crysta', 'local', 0, 0, 0, 6),
('Sedan', 'Sedan cars', 'airport', 0, 0, 0, 4),
('SUV', 'SUV cars', 'airport', 0, 0, 0, 6),
('Sedan', 'Sedan cars', 'outstation', 0, 0, 0, 4),
('SUV', 'SUV cars', 'outstation', 0, 0, 0, 6);
