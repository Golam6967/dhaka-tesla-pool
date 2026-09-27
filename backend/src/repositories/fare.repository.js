const { pool } = require('../db/pool');

async function createWithClient(
  client,
  { rideRequestId, baseFarePaisa, distanceChargePaisa, poolDiscountPaisa, totalFarePaisa }
) {
  const { rows } = await client.query(
    `INSERT INTO fares (ride_request_id, base_fare_paisa, distance_charge_paisa, pool_discount_paisa, total_fare_paisa)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [rideRequestId, baseFarePaisa, distanceChargePaisa, poolDiscountPaisa, totalFarePaisa]
  );
  return rows[0];
}

async function findByRideRequestId(rideRequestId) {
  const { rows } = await pool.query('SELECT * FROM fares WHERE ride_request_id = $1', [
    rideRequestId,
  ]);
  return rows[0] || null;
}

function toPublic(fare) {
  return {
    id: fare.id,
    rideRequestId: fare.ride_request_id,
    baseFarePaisa: fare.base_fare_paisa,
    distanceChargePaisa: fare.distance_charge_paisa,
    poolDiscountPaisa: fare.pool_discount_paisa,
    totalFarePaisa: fare.total_fare_paisa,
    paymentMethod: fare.payment_method,
    paymentStatus: fare.payment_status,
  };
}

module.exports = { createWithClient, findByRideRequestId, toPublic };
