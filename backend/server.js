const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load .env before database so DATABASE_PATH is set when db/database.js runs
dotenv.config({ path: path.join(__dirname, '.env') });

const db = require('./db/database');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));
app.use('/api/uploads', express.static(uploadsDir));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/cabs', require('./routes/cabs'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/routes', require('./routes/routes'));
app.use('/api/car-options', require('./routes/carOptions'));
app.use('/api/corporate', require('./routes/corporate'));
app.use('/api/events', require('./routes/events'));
app.use('/api/address', require('./routes/address'));
app.use('/api/places', require('./routes/places'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

const frontendBuild = process.env.FRONTEND_BUILD_PATH
  ? path.resolve(process.env.FRONTEND_BUILD_PATH)
  : path.join(__dirname, '../frontend/build');
if (fs.existsSync(frontendBuild)) {
  app.use(express.static(frontendBuild));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    res.sendFile(path.join(frontendBuild, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

process.on('SIGINT', async () => {
  try {
    if (typeof db.close === 'function') {
      await db.close((err) => {
        if (err) {
          console.error('Error closing database:', err.message);
        } else {
          console.log('Database connection closed');
        }
      });
    } else if (db.pool) {

      await db.pool.end();
      console.log('MySQL connection pool closed');
    }
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
});

module.exports = app;
