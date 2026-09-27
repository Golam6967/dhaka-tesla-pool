const { pool } = require('../db/pool');

async function findById(id) {
  const { rows } = await pool.query('SELECT * FROM zones WHERE id = $1', [id]);
  return rows[0] || null;
}

async function findAll() {
  const { rows } = await pool.query(
    `SELECT z.id, z.name, z.corridor_id, c.name AS corridor_name
     FROM zones z
     JOIN corridors c ON c.id = z.corridor_id
     ORDER BY z.name ASC`
  );
  return rows;
}

function toPublic(zone) {
  return {
    id: zone.id,
    name: zone.name,
    corridorId: zone.corridor_id,
    corridorName: zone.corridor_name,
  };
}

module.exports = { findById, findAll, toPublic };
