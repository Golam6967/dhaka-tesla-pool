require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../src/db/pool');

// Illustrative Dhaka coordinates for the fixed zone list — not from a live
// geocoding source (architecture.md §8: zones are manually curated, not
// computed from real geography). Deliberately calibrated so the haversine
// distance from Banani rounds to the exact whole-km figures the fare model's
// worked example requires (Mohakhali = 4km, Gulshan 1 = 3km) — see
// src/services/fare.service.js for the distance calculation itself.
const ZONES = [
  { name: 'Banani', lat: 23.7936, lng: 90.4043 },
  { name: 'Mohakhali', lat: 23.7936, lng: 90.44357 },
  { name: 'Gulshan 1', lat: 23.7936, lng: 90.43375 },
  { name: 'Gulshan 2', lat: 23.7936, lng: 90.43866 },
];

const DEMO_PASSWORD = 'password123';

async function seed() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(`
      TRUNCATE fares, pool_status_history, ride_status_history, pool_members,
        ride_requests, pools, teslas, zones, corridors, users
        RESTART IDENTITY CASCADE
    `);

    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

    const {
      rows: [jashim],
    } = await client.query(
      `INSERT INTO users (name, phone, password_hash, role)
       VALUES ('Jashim', '+8801700000001', $1, 'driver') RETURNING id`,
      [passwordHash]
    );

    const passengerCast = [
      { name: 'Nusrat', phone: '+8801700000002' },
      { name: 'Rafiq', phone: '+8801700000003' },
      { name: 'Shirin', phone: '+8801700000004' },
    ];
    for (const passenger of passengerCast) {
      await client.query(
        `INSERT INTO users (name, phone, password_hash, role)
         VALUES ($1, $2, $3, 'passenger')`,
        [passenger.name, passenger.phone, passwordHash]
      );
    }

    await client.query(
      `INSERT INTO teslas (driver_id, label, capacity, status)
       VALUES ($1, 'Bullet', 3, 'online')`,
      [jashim.id]
    );

    const {
      rows: [corridor],
    } = await client.query(
      `INSERT INTO corridors (name) VALUES ('Banani-Gulshan-Mohakhali') RETURNING id`
    );

    for (const zone of ZONES) {
      await client.query(
        `INSERT INTO zones (name, corridor_id, lat, lng) VALUES ($1, $2, $3, $4)`,
        [zone.name, corridor.id, zone.lat, zone.lng]
      );
    }

    await client.query('COMMIT');
    console.log('Seed complete: Jashim/Bullet, Nusrat, Rafiq, Shirin, zones, corridor.');
    console.log(`Demo password for all seeded users: ${DEMO_PASSWORD}`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
