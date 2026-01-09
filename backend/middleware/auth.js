const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

const requireRole = (roles = []) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Admin or Manager access required' });
  }
  next();
};

// Middleware to check manager permissions for a specific section
const requireManagerPermission = (sectionKey, requireEdit = false) => {
  return async (req, res, next) => {
    // Admins have full access
    if (req.user.role === 'admin') {
      return next();
    }
    
    // Managers need permission check
    if (req.user.role === 'manager') {
      try {
        const db = require('../db/database');
        const permission = await db.getAsync(
          'SELECT can_view, can_edit FROM manager_permissions WHERE user_id = ? AND section_key = ?',
          [req.user.id, sectionKey]
        );
        
        if (!permission) {
          return res.status(403).json({ error: 'You do not have access to this section' });
        }
        
        if (requireEdit && permission.can_edit !== 1) {
          return res.status(403).json({ error: 'You do not have edit permission for this section' });
        }
        
        if (permission.can_view !== 1) {
          return res.status(403).json({ error: 'You do not have view permission for this section' });
        }
        
        return next();
      } catch (error) {
        console.error('Error checking manager permission:', error);
        return res.status(500).json({ error: 'Error checking permissions' });
      }
    }
    
    return res.status(403).json({ error: 'Access denied' });
  };
};

module.exports = { authenticateToken, requireAdmin, requireRole, requireManagerPermission };

