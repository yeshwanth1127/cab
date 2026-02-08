const bcrypt = require('bcryptjs');
const db = require('../db/database');
require('dotenv').config();

async function setupAdmin() {
  const username = process.argv[2] || 'admin';
  const password = process.argv[3] || 'admin123';
  const email = process.argv[4] || 'admin@cabcompany.com';

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    

    const existingUser = await db.getAsync(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );

    if (existingUser) {

      await db.runAsync(
        `UPDATE users SET password_hash = ?, email = ?, role = 'admin' WHERE username = ?`,
        [passwordHash, email, username]
      );
      console.log(`✅ Admin user "${username}" has been updated successfully!`);
    } else {

      await db.runAsync(
        `INSERT INTO users (username, email, password_hash, role) 
         VALUES (?, ?, ?, 'admin')`,
        [username, email, passwordHash]
      );
      console.log(`✅ Admin user "${username}" has been created successfully!`);
    }

    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    

    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
      }
      process.exit(0);
    });
  } catch (error) {
    console.error('❌ Error setting up admin:', error);
    db.close();
    process.exit(1);
  }
}

setupAdmin();
