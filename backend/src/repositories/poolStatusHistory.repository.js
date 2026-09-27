async function insert(client, { poolId, seatsOccupiedBefore, seatsOccupiedAfter, event }) {
  const { rows } = await client.query(
    `INSERT INTO pool_status_history (pool_id, seats_occupied_before, seats_occupied_after, event)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [poolId, seatsOccupiedBefore, seatsOccupiedAfter, event]
  );
  return rows[0];
}

module.exports = { insert };
