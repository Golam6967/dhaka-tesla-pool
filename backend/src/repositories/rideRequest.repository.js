const { pool } = require('../db/pool');

async function createWithClient(client, { passengerId, pickupZoneId, destinationZoneId, seatsRequested }) {
  const { rows } = await client.query(
    `INSERT INTO ride_requests (passenger_id, pickup_zone_id, destination_zone_id, seats_requested)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [passengerId, pickupZoneId, destinationZoneId, seatsRequested]
  );
  return rows[0];
}

async function markMatchedWithClient(client, rideRequestId, poolId) {
  const { rows } = await client.query(
    `UPDATE ride_requests SET status = 'matched', pool_id = $1, matched_at = now()
     WHERE id = $2 RETURNING *`,
    [poolId, rideRequestId]
  );
  return rows[0];
}

// Row-level lock so a ride request cannot be matched twice by two concurrent
// join attempts (mirrors the pool row lock in pool.repository.js).
async function findByIdForUpdate(client, id) {
  const { rows } = await client.query('SELECT * FROM ride_requests WHERE id = $1 FOR UPDATE', [id]);
  return rows[0] || null;
}

async function markDriverArrivedWithClient(client, id) {
  const { rows } = await client.query(
    `UPDATE ride_requests SET status = 'driver_arrived', arrived_at = now() WHERE id = $1 RETURNING *`,
    [id]
  );
  return rows[0];
}

async function markStartedWithClient(client, id) {
  const { rows } = await client.query(
    `UPDATE ride_requests SET status = 'started', started_at = now() WHERE id = $1 RETURNING *`,
    [id]
  );
  return rows[0];
}

async function markCompletedWithClient(client, id) {
  const { rows } = await client.query(
    `UPDATE ride_requests SET status = 'completed', completed_at = now() WHERE id = $1 RETURNING *`,
    [id]
  );
  return rows[0];
}

async function findById(id) {
  const { rows } = await pool.query('SELECT * FROM ride_requests WHERE id = $1', [id]);
  return rows[0] || null;
}

async function findPending() {
  const { rows } = await pool.query(
    `SELECT * FROM ride_requests WHERE status = 'requested' ORDER BY requested_at ASC`
  );
  return rows;
}

async function findByPassengerId(passengerId) {
  const { rows } = await pool.query(
    'SELECT * FROM ride_requests WHERE passenger_id = $1 ORDER BY requested_at DESC',
    [passengerId]
  );
  return rows;
}

function toPublic(rideRequest) {
  return {
    id: rideRequest.id,
    passengerId: rideRequest.passenger_id,
    pickupZoneId: rideRequest.pickup_zone_id,
    destinationZoneId: rideRequest.destination_zone_id,
    seatsRequested: rideRequest.seats_requested,
    status: rideRequest.status,
    poolId: rideRequest.pool_id,
    requestedAt: rideRequest.requested_at,
    matchedAt: rideRequest.matched_at,
    arrivedAt: rideRequest.arrived_at,
    startedAt: rideRequest.started_at,
    completedAt: rideRequest.completed_at,
    cancelledAt: rideRequest.cancelled_at,
  };
}

module.exports = {
  createWithClient,
  findById,
  findByIdForUpdate,
  findPending,
  findByPassengerId,
  markMatchedWithClient,
  markDriverArrivedWithClient,
  markStartedWithClient,
  markCompletedWithClient,
  toPublic,
};
