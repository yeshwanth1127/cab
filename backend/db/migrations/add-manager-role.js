const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const db = require('../database');

async function runMigration() {
  try {
    console.log('🔄 Starting migration: Add Manager Role and Permissions...');

    

    try {
      const testUser = await db.getAsync("SELECT role FROM users WHERE role = 'manager' LIMIT 1");
      if (testUser) {
        console.log('✅ Manager role already exists in database');
      }
    } catch (e) {

    }

    
    if (process.env.DB_HOST) {

      try {
        await db.runAsync(`
          ALTER TABLE users 
          DROP CHECK IF EXISTS users_role_check,
          ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'admin', 'manager'))
        `);
        console.log('✅ Updated users table role constraint (MySQL)');
      } catch (err) {

        try {
          await db.runAsync(`
            ALTER TABLE users 
            MODIFY COLUMN role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'manager'))
          `);
          console.log('✅ Updated users table role constraint (MySQL alternative)');
        } catch (err2) {
          console.log('⚠️  Could not update role constraint (may already be updated):', err2.message);
        }
      }
    } else {

      try {

        const tableInfo = await db.allAsync("PRAGMA table_info(users)");
        const roleColumn = tableInfo.find(col => col.name === 'role');
        
        if (roleColumn) {

          console.log('📋 Creating new users table with manager role support...');
          
          await db.runAsync(`
            CREATE TABLE IF NOT EXISTS users_new (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              username TEXT UNIQUE NOT NULL,
              email TEXT UNIQUE NOT NULL,
              password_hash TEXT NOT NULL,
              role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'manager')),
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
          `);
          

          await db.runAsync(`
            INSERT INTO users_new (id, username, email, password_hash, role, created_at)
            SELECT id, username, email, password_hash, role, created_at FROM users
          `);
          

          await db.runAsync('DROP TABLE users');
          

          await db.runAsync('ALTER TABLE users_new RENAME TO users');
          
          console.log('✅ Updated users table role constraint (SQLite)');
        }
      } catch (err) {
        console.log('⚠️  Could not update role constraint (may already be updated):', err.message);
      }
    }

    const managerPermissionsSQL = process.env.DB_HOST
      ? `CREATE TABLE IF NOT EXISTS manager_permissions (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          section_key VARCHAR(100) NOT NULL,
          can_view INT DEFAULT 0,
          can_edit INT DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY unique_user_section (user_id, section_key),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`
      : `CREATE TABLE IF NOT EXISTS manager_permissions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          section_key TEXT NOT NULL,
          can_view INTEGER DEFAULT 0,
          can_edit INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, section_key),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`;

    try {
      await db.runAsync(managerPermissionsSQL);
      console.log('✅ Created manager_permissions table');
    } catch (err) {
      if (err.message.includes('already exists') || err.message.includes('duplicate')) {
        console.log('✅ manager_permissions table already exists');
      } else {
        throw err;
      }
    }

    console.log('✅ Migration completed successfully!');
    console.log('');
    console.log('📝 Next steps:');
    console.log('   1. Restart your backend server');
    console.log('   2. Use the admin panel to create manager accounts');
    console.log('   3. Select permissions for each manager during creation');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {

    process.exit(0);
  }
}

if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };
