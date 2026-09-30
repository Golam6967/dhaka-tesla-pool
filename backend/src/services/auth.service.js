const bcrypt = require('bcryptjs');
const userRepository = require('../repositories/user.repository');
const { signToken } = require('../config/jwt');
const { ConflictError, UnauthorizedError } = require('../errors');
const { isUniqueViolation } = require('../db/pgErrors');

const SALT_ROUNDS = 10;

// A precomputed bcrypt hash with no corresponding real password, compared
// against on every "user not found" login so that path takes the same time
// as a real wrong-password check (see login() below).
const DUMMY_PASSWORD_HASH = '$2b$10$iYmJiYIVP9WRSa1i9EUlJeEiUVU9zBxm.ElZkfg/Mx5VlMN0z/PKO';

async function signup({ name, phone, password, role }) {
  const existing = await userRepository.findByPhone(phone);
  if (existing) {
    throw new ConflictError('An account with this phone number already exists');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  try {
    const user = await userRepository.create({ name, phone, passwordHash, role });
    return {
      token: signToken(user),
      user: userRepository.toPublicUser(user),
    };
  } catch (err) {
    // The check above has a race window — two concurrent signups with the
    // same phone can both pass it. The database's own UNIQUE constraint is
    // the real guard; this converts that into the same clean 409 the
    // pre-check gives, instead of a raw Postgres error reaching the client.
    if (isUniqueViolation(err, 'users_phone_key')) {
      throw new ConflictError('An account with this phone number already exists');
    }
    throw err;
  }
}

async function login({ phone, password }) {
  const user = await userRepository.findByPhone(phone);

  // Same error for "no such user" and "wrong password" so a caller can't
  // use this endpoint to enumerate registered phone numbers. Running
  // bcrypt.compare unconditionally (against a dummy hash when there's no
  // real user) also equalizes the response time between the two cases —
  // otherwise a missing user returns near-instantly while a wrong password
  // takes as long as bcrypt does, which itself leaks which phones exist.
  const hashToCompare = user ? user.password_hash : DUMMY_PASSWORD_HASH;
  const passwordMatches = await bcrypt.compare(password, hashToCompare);

  if (!user || !passwordMatches) {
    throw new UnauthorizedError();
  }

  return {
    token: signToken(user),
    user: userRepository.toPublicUser(user),
  };
}

module.exports = { signup, login };
