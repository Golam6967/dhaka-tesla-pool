const { pool } = require('../db/pool');

async function findByPhone(phone) {
  const { rows } = await pool.query('SELECT * FROM users WHERE phone = $1', [phone]);
  return rows[0] || null;
}

async function findById(id) {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] || null;
}

async function create({ name, phone, passwordHash, role }) {
  const { rows } = await pool.query(
    `INSERT INTO users (name, phone, password_hash, role)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [name, phone, passwordHash, role]
  );
  return rows[0];
}

function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role,
    createdAt: user.created_at,
  };
}

module.exports = { findByPhone, findById, create, toPublicUser };
