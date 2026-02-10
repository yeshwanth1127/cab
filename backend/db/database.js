const path = require('path');

const usePostgres =
  process.env.DATABASE_URL ||
  process.env.PG_HOST ||
  process.env.PGHOST;

let db;
let pool;

if (usePostgres) {
  const { Pool } = require('pg');

  const config = process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.PG_HOST || process.env.PGHOST || 'localhost',
        port: parseInt(process.env.PG_PORT || process.env.PGPORT || '5432', 10),
        user: process.env.PG_USER || process.env.PGUSER || 'postgres',
        password: process.env.PG_PASSWORD || process.env.PGPASSWORD || '',
        database: process.env.PG_DATABASE || process.env.PGDATABASE || 'cab_booking',
        max: 10,
        idleTimeoutMillis: 30000,
      };

  pool = new Pool(config);

  pool.on('error', (err) => {
    console.error('PostgreSQL pool error:', err.message);
  });

  function toPgPlaceholders(sql) {
    let n = 0;
    return sql.replace(/\?/g, () => `$${++n}`);
  }

  async function runAsync(sql, params = []) {
    const pgSql = toPgPlaceholders(sql);
    const isInsert = /^\s*INSERT\s+/i.test(sql) && !/RETURNING\s+/i.test(sql);
    const runSql = isInsert ? pgSql.replace(/;\s*$/, '') + ' RETURNING id' : pgSql;
    const result = await pool.query(runSql, params);
    const lastID = isInsert && result.rows && result.rows[0] ? Number(result.rows[0].id) : 0;
    const changes = result.rowCount != null ? result.rowCount : 0;
    return { lastID, changes };
  }

  function getAsync(sql, params = []) {
    return pool.query(toPgPlaceholders(sql), params).then((r) => r.rows[0] || null);
  }

  function allAsync(sql, params = []) {
    return pool.query(toPgPlaceholders(sql), params).then((r) => r.rows || []);
  }

  function close(callback) {
    if (!pool) {
      if (callback) callback(null);
      return Promise.resolve();
    }
    return pool
      .end()
      .then(() => {
        if (callback) callback(null);
      })
      .catch((err) => {
        if (callback) callback(err);
        throw err;
      });
  }

  db = { runAsync, getAsync, allAsync, close, pool };
} else {
  const sqlite3 = require('sqlite3').verbose();
  const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'cab_booking.db');
  const sqliteDb = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('Error opening SQLite database:', err.message);
  });

  function runAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
      sqliteDb.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  function getAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
      sqliteDb.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row ?? null);
      });
    });
  }

  function allAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
      sqliteDb.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  function close(callback) {
    sqliteDb.close(callback);
  }

  db = { runAsync, getAsync, allAsync, close };
}

module.exports = db;
