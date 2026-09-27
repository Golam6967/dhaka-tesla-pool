async function create(client, { poolId, rideRequestId, seats }) {
  const { rows } = await client.query(
    `INSERT INTO pool_members (pool_id, ride_request_id, seats) VALUES ($1, $2, $3) RETURNING *`,
    [poolId, rideRequestId, seats]
  );
  return rows[0];
}

// Joined with ride_requests so callers can check zone/corridor compatibility
// and recompute fares without a second round trip per member.
async function findMembersWithRideDetails(client, poolId) {
  const { rows } = await client.query(
    `SELECT pm.ride_request_id, pm.seats, rr.pickup_zone_id, rr.destination_zone_id
     FROM pool_members pm
     JOIN ride_requests rr ON rr.id = pm.ride_request_id
     WHERE pm.pool_id = $1`,
    [poolId]
  );
  return rows;
}

async function findSiblingStatuses(client, poolId) {
  const { rows } = await client.query(
    `SELECT rr.status FROM pool_members pm
     JOIN ride_requests rr ON rr.id = pm.ride_request_id
     WHERE pm.pool_id = $1`,
    [poolId]
  );
  return rows.map((row) => row.status);
}

async function deleteByRideRequestId(client, rideRequestId) {
  await client.query('DELETE FROM pool_members WHERE ride_request_id = $1', [rideRequestId]);
}

module.exports = {
  create,
  findMembersWithRideDetails,
  findSiblingStatuses,
  deleteByRideRequestId,
};
