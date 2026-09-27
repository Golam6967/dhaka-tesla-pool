const bcrypt = require('bcryptjs');
const userRepository = require('../repositories/user.repository');
const { signToken } = require('../config/jwt');
const { ConflictError, UnauthorizedError } = require('../errors');

const SALT_ROUNDS = 10;

async function signup({ name, phone, password, role }) {
  const existing = await userRepository.findByPhone(phone);
  if (existing) {
    throw new ConflictError('An account with this phone number already exists');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await userRepository.create({ name, phone, passwordHash, role });

  return {
    token: signToken(user),
    user: userRepository.toPublicUser(user),
  };
}

async function login({ phone, password }) {
  const user = await userRepository.findByPhone(phone);

  // Same error for "no such user" and "wrong password" so a caller can't
  // use this endpoint to enumerate registered phone numbers.
  if (!user) {
    throw new UnauthorizedError();
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatches) {
    throw new UnauthorizedError();
  }

  return {
    token: signToken(user),
    user: userRepository.toPublicUser(user),
  };
}

module.exports = { signup, login };
