const { pool: dbPool } = require('../db/pool');

async function findActiveOrFormingByTeslaId(teslaId) {
  const { rows } = await dbPool.query(
    `SELECT * FROM pools WHERE tesla_id = $1 AND status IN ('forming', 'active')`,
    [teslaId]
  );
  return rows[0] || null;
}

async function findById(poolId) {
  const { rows } = await dbPool.query('SELECT * FROM pools WHERE id = $1', [poolId]);
  return rows[0] || null;
}

// Locks any existing forming/active pool for this Tesla for the duration of
// the caller's transaction. This single statement is what serializes
// concurrent seat claims against the same pool (architecture.md §4a).
async function findLockedActiveOrFormingByTeslaId(client, teslaId) {
  const { rows } = await client.query(
    `SELECT * FROM pools WHERE tesla_id = $1 AND status IN ('forming', 'active') FOR UPDATE`,
    [teslaId]
  );
  return rows[0] || null;
}

// May throw a unique_violation on the one_active_pool_per_tesla partial
// index if another transaction committed a pool for this Tesla first
// (architecture.md §4b) — callers must catch and retry.
async function createForming(client, teslaId) {
  const { rows } = await client.query(
    `INSERT INTO pools (tesla_id, status, seats_occupied) VALUES ($1, 'forming', 0) RETURNING *`,
    [teslaId]
  );
  return rows[0];
}

async function findByIdForUpdate(client, poolId) {
  const { rows } = await client.query('SELECT * FROM pools WHERE id = $1 FOR UPDATE', [poolId]);
  return rows[0] || null;
}

async function updateStatus(client, poolId, status) {
  const { rows } = await client.query('UPDATE pools SET status = $1 WHERE id = $2 RETURNING *', [
    status,
    poolId,
  ]);
  return rows[0];
}

async function updateSeatsOccupied(client, poolId, seatsOccupied) {
  const { rows } = await client.query(
    `UPDATE pools SET seats_occupied = $1 WHERE id = $2 RETURNING *`,
    [seatsOccupied, poolId]
  );
  return rows[0];
}

function toPublic(pool) {
  return {
    id: pool.id,
    teslaId: pool.tesla_id,
    seatsOccupied: pool.seats_occupied,
    status: pool.status,
    createdAt: pool.created_at,
  };
}

module.exports = {
  findActiveOrFormingByTeslaId,
  findById,
  findLockedActiveOrFormingByTeslaId,
  findByIdForUpdate,
  createForming,
  updateSeatsOccupied,
  updateStatus,
  toPublic,
};
