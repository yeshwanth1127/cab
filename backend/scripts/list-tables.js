#!/usr/bin/env node
/**
 * List tables in the configured database.
 * Loads .env from backend directory.
 *
 * PostgreSQL: set DATABASE_URL or PG_HOST, PG_USER, PG_PASSWORD, PG_DATABASE in .env
 * SQLite: set DATABASE_PATH or leave unset (uses db/cab_booking.db)
 */
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const usePg = process.env.DATABASE_URL || process.env.PG_HOST || process.env.PGHOST;

async function main() {
  if (usePg) {
    const { Pool } = require('pg');
    const config = process.env.DATABASE_URL
      ? { connectionString: process.env.DATABASE_URL }
      : {
          host: process.env.PG_HOST || process.env.PGHOST || 'localhost',
          port: parseInt(process.env.PG_PORT || process.env.PGPORT || '5432', 10),
          user: process.env.PG_USER || process.env.PGUSER || 'postgres',
          password: process.env.PG_PASSWORD || process.env.PGPASSWORD || '',
          database: process.env.PG_DATABASE || process.env.PGDATABASE || 'postgres',
        };
    const pool = new Pool(config);
    try {
      const r = await pool.query(`
        SELECT table_schema, table_name
        FROM information_schema.tables
        WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
        ORDER BY table_schema, table_name
      `);
      console.log('PostgreSQL tables:');
      console.log(r.rows.length ? r.rows.map((x) => `  ${x.table_schema}.${x.table_name}`).join('\n') : '  (none)');
      await pool.end();
    } catch (e) {
      console.error('PostgreSQL error:', e.message);
      process.exit(1);
    }
    return;
  }

  const sqlite3 = require('sqlite3').verbose();
  const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'db', 'cab_booking.db');
  console.log('SQLite database:', dbPath);
  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error opening DB:', err.message);
      process.exit(1);
    }
  });
  db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", [], (err, rows) => {
    if (err) {
      console.error(err.message);
      process.exit(1);
    }
    console.log('SQLite tables:');
    console.log(rows && rows.length ? rows.map((r) => `  ${r.name}`).join('\n') : '  (none)');
    db.close();
  });
}

main();
