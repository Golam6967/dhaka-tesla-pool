require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '..', '.env') });
const { Pool } = require('pg');

const testPool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });

async function truncateAll() {
  await testPool.query(`
    TRUNCATE fares, pool_status_history, ride_status_history, pool_members,
      ride_requests, pools, teslas, zones, corridors, users
      RESTART IDENTITY CASCADE
  `);
}

async function insertUser({ name, phone, role }) {
  const { rows } = await testPool.query(
    `INSERT INTO users (name, phone, password_hash, role)
     VALUES ($1, $2, 'placeholder-hash', $3) RETURNING id`,
    [name, phone, role]
  );
  return rows[0].id;
}

async function insertTesla({ driverId, label, capacity, status = 'online' }) {
  const { rows } = await testPool.query(
    `INSERT INTO teslas (driver_id, label, capacity, status)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [driverId, label, capacity, status]
  );
  return rows[0].id;
}

async function insertCorridor(name) {
  const { rows } = await testPool.query(
    `INSERT INTO corridors (name) VALUES ($1) RETURNING id`,
    [name]
  );
  return rows[0].id;
}

async function insertZone({ name, corridorId }) {
  const { rows } = await testPool.query(
    `INSERT INTO zones (name, corridor_id) VALUES ($1, $2) RETURNING id`,
    [name, corridorId]
  );
  return rows[0].id;
}

async function insertRideRequest({ passengerId, pickupZoneId, destinationZoneId, seatsRequested = 1 }) {
  const { rows } = await testPool.query(
    `INSERT INTO ride_requests (passenger_id, pickup_zone_id, destination_zone_id, seats_requested)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [passengerId, pickupZoneId, destinationZoneId, seatsRequested]
  );
  return rows[0].id;
}

async function insertPool({ teslaId, status = 'forming', seatsOccupied = 0 }) {
  const { rows } = await testPool.query(
    `INSERT INTO pools (tesla_id, status, seats_occupied) VALUES ($1, $2, $3) RETURNING id`,
    [teslaId, status, seatsOccupied]
  );
  return rows[0].id;
}

module.exports = {
  testPool,
  truncateAll,
  insertUser,
  insertTesla,
  insertCorridor,
  insertZone,
  insertRideRequest,
  insertPool,
};
