const { pool } = require('../db/pool');

async function createWithClient(client, { passengerId, pickupZoneId, destinationZoneId, seatsRequested }) {
  const { rows } = await client.query(
    `INSERT INTO ride_requests (passenger_id, pickup_zone_id, destination_zone_id, seats_requested)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [passengerId, pickupZoneId, destinationZoneId, seatsRequested]
  );
  return rows[0];
}

async function findById(id) {
  const { rows } = await pool.query('SELECT * FROM ride_requests WHERE id = $1', [id]);
  return rows[0] || null;
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

module.exports = { createWithClient, findById, findByPassengerId, toPublic };
