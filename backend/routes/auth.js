const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// User registration
router.post(
  '/register',
  [
    body('username').notEmpty().withMessage('Username is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { username, email, password } = req.body;

      const existing = await db.getAsync(
        'SELECT id FROM users WHERE username = ? OR email = ?',
        [username, email]
      );

      if (existing) {
        return res.status(400).json({ error: 'Username or email already in use' });
      }

      const password_hash = await bcrypt.hash(password, 10);

      const result = await db.runAsync(
        'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
        [username, email, password_hash, 'user']
      );

      const user = await db.getAsync(
        'SELECT id, username, email, role FROM users WHERE id = ?',
        [result.lastID]
      );

      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        process.env.JWT_SECRET || 'your_secret_key',
        { expiresIn: '24h' }
      );

      res.status(201).json({ token, user });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ error: 'Server error during registration' });
    }
  }
);

// Login (for both admins and regular users)
router.post('/login', [
  body('username').notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;

    const user = await db.getAsync(
      'SELECT id, username, email, password_hash, role FROM users WHERE username = ?',
      [username]
    );

    if (!user) {
      console.log(`Login attempt failed: User "${username}" not found`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.password_hash) {
      console.log(`Login attempt failed: User "${username}" has no password hash`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      console.log(`Login attempt failed: Invalid password for user "${username}"`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Fetch permissions if manager
    let permissions = [];
    if (user.role === 'manager') {
      const perms = await db.allAsync(
        'SELECT section_key, can_view, can_edit FROM manager_permissions WHERE user_id = ?',
        [user.id]
      );
      permissions = perms.map(p => ({
        section_key: p.section_key,
        can_view: Boolean(p.can_view === 1 || p.can_view === true),
        can_edit: Boolean(p.can_edit === 1 || p.can_edit === true)
      }));
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'your_secret_key',
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        permissions: permissions,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Register admin user (requires admin authentication)
router.post(
  '/register-admin',
  authenticateToken,
  [
    body('username').notEmpty().withMessage('Username is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  async (req, res) => {
    try {
      // Check if current user is admin
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can register other admin users' });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { username, email, password, role = 'admin', permissions = [] } = req.body;

      // Validate role
      if (role !== 'admin' && role !== 'manager') {
        return res.status(400).json({ error: 'Role must be either "admin" or "manager"' });
      }

      // Validate permissions if manager
      if (role === 'manager') {
        if (!Array.isArray(permissions)) {
          return res.status(400).json({ error: 'Permissions must be an array' });
        }
        // Validate permission structure
        for (const perm of permissions) {
          if (!perm.section_key || typeof perm.can_view !== 'boolean' || typeof perm.can_edit !== 'boolean') {
            return res.status(400).json({ error: 'Invalid permission structure. Each permission must have section_key, can_view, and can_edit' });
          }
        }
      }

      const existing = await db.getAsync(
        'SELECT id FROM users WHERE username = ? OR email = ?',
        [username, email]
      );

      if (existing) {
        return res.status(400).json({ error: 'Username or email already in use' });
      }

      const password_hash = await bcrypt.hash(password, 10);

      const result = await db.runAsync(
        'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
        [username, email, password_hash, role]
      );

      const userId = result.lastID;

      // Insert permissions if manager
      if (role === 'manager' && permissions.length > 0) {
        for (const perm of permissions) {
          try {
            await db.runAsync(
              'INSERT INTO manager_permissions (user_id, section_key, can_view, can_edit) VALUES (?, ?, ?, ?)',
              [userId, perm.section_key, perm.can_view ? 1 : 0, perm.can_edit ? 1 : 0]
            );
          } catch (permError) {
            console.error('Error inserting permission:', permError);
            // Continue with other permissions
          }
        }
      }

      const user = await db.getAsync(
        'SELECT id, username, email, role FROM users WHERE id = ?',
        [userId]
      );

      res.status(201).json({ 
        message: `${role === 'admin' ? 'Admin' : 'Manager'} user created successfully`, 
        user 
      });
    } catch (error) {
      console.error('Register admin error:', error);
      res.status(500).json({ error: 'Server error during admin registration' });
    }
  }
);

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await db.getAsync(
      'SELECT id, username, email, role FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Fetch permissions if manager
    let permissions = [];
    if (user.role === 'manager') {
      const perms = await db.allAsync(
        'SELECT section_key, can_view, can_edit FROM manager_permissions WHERE user_id = ?',
        [user.id]
      );
      permissions = perms.map(p => ({
        section_key: p.section_key,
        can_view: Boolean(p.can_view === 1 || p.can_view === true),
        can_edit: Boolean(p.can_edit === 1 || p.can_edit === true)
      }));
    }

    res.json({ 
      user: {
        ...user,
        permissions
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
