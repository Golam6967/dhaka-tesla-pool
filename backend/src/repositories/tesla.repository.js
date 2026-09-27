const { pool } = require('../db/pool');

async function createWithClient(client, { driverId, label, capacity }) {
  const { rows } = await client.query(
    `INSERT INTO teslas (driver_id, label, capacity, status)
     VALUES ($1, $2, $3, 'offline') RETURNING *`,
    [driverId, label, capacity]
  );
  return rows[0];
}

async function findByDriverId(driverId) {
  const { rows } = await pool.query('SELECT * FROM teslas WHERE driver_id = $1', [driverId]);
  return rows[0] || null;
}

async function updateStatus(teslaId, status) {
  const { rows } = await pool.query(
    'UPDATE teslas SET status = $1 WHERE id = $2 RETURNING *',
    [status, teslaId]
  );
  return rows[0] || null;
}

function toPublicTesla(tesla) {
  return {
    id: tesla.id,
    driverId: tesla.driver_id,
    label: tesla.label,
    capacity: tesla.capacity,
    status: tesla.status,
  };
}

module.exports = { createWithClient, findByDriverId, updateStatus, toPublicTesla };
