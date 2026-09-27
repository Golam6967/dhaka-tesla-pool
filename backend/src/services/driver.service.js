const bcrypt = require('bcryptjs');
const { pool } = require('../db/pool');
const userRepository = require('../repositories/user.repository');
const teslaRepository = require('../repositories/tesla.repository');
const { signToken } = require('../config/jwt');
const { ConflictError, NotFoundError } = require('../errors');

const SALT_ROUNDS = 10;

async function signup({ name, phone, password, teslaLabel, teslaCapacity }) {
  const existing = await userRepository.findByPhone(phone);
  if (existing) {
    throw new ConflictError('An account with this phone number already exists');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const user = await userRepository.createWithClient(client, {
      name,
      phone,
      passwordHash,
      role: 'driver',
    });
    const tesla = await teslaRepository.createWithClient(client, {
      driverId: user.id,
      label: teslaLabel,
      capacity: teslaCapacity,
    });
    await client.query('COMMIT');

    return {
      token: signToken(user),
      user: userRepository.toPublicUser(user),
      tesla: teslaRepository.toPublicTesla(tesla),
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function setStatus(driverId, status) {
  const tesla = await teslaRepository.findByDriverId(driverId);
  if (!tesla) {
    throw new NotFoundError('No Tesla is registered for this driver');
  }

  const updated = await teslaRepository.updateStatus(tesla.id, status);
  return teslaRepository.toPublicTesla(updated);
}

module.exports = { signup, setStatus };
