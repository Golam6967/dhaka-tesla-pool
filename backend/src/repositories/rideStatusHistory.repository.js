async function insertWithClient(client, { rideRequestId, fromStatus, toStatus }) {
  const { rows } = await client.query(
    `INSERT INTO ride_status_history (ride_request_id, from_status, to_status)
     VALUES ($1, $2, $3) RETURNING *`,
    [rideRequestId, fromStatus, toStatus]
  );
  return rows[0];
}

module.exports = { insertWithClient };
