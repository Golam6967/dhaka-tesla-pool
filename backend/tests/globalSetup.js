require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const { Client } = require('pg');
const { runner } = require('node-pg-migrate');
const path = require('path');

module.exports = async () => {
  const testDbUrl = process.env.TEST_DATABASE_URL;
  if (!testDbUrl) {
    throw new Error('TEST_DATABASE_URL is not set — copy .env.example to .env first.');
  }

  const url = new URL(testDbUrl);
  const dbName = url.pathname.slice(1);

  const adminUrl = new URL(testDbUrl);
  adminUrl.pathname = '/postgres';
  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  const { rows } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (rows.length === 0) {
    await admin.query(`CREATE DATABASE "${dbName}"`);
  }
  await admin.end();

  await runner({
    databaseUrl: testDbUrl,
    dir: path.join(__dirname, '..', 'migrations'),
    direction: 'up',
    migrationsTable: 'pgmigrations',
    log: () => {},
  });
};
