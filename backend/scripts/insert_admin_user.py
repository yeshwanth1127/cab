import sqlite3
import bcrypt

# CONFIGURE THESE VALUES
DB_PATH = '/var/www/nammacabs/cab/backend/db/cab_booking.db'
ADMIN_USERNAME = 'admin'
ADMIN_EMAIL = 'admin@example.com'
ADMIN_PASSWORD = 'admin123'  # Change this!

# Hash the password
hashed = bcrypt.hashpw(ADMIN_PASSWORD.encode('utf-8'), bcrypt.gensalt())

# Connect to the database
conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

# Insert admin user
c.execute('''
INSERT OR REPLACE INTO users (id, username, email, password_hash, role)
VALUES (
    (SELECT id FROM users WHERE username = ?),
    ?, ?, ?, 'admin'
)
''', (ADMIN_USERNAME, ADMIN_USERNAME, ADMIN_EMAIL, hashed.decode('utf-8')))

conn.commit()
conn.close()
print('Admin user inserted/updated successfully.')
