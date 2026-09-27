const { pool } = require('../db/pool');

async function findById(id) {
  const { rows } = await pool.query('SELECT * FROM zones WHERE id = $1', [id]);
  return rows[0] || null;
}

module.exports = { findById };
