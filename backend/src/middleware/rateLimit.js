const rateLimit = require('express-rate-limit');

// Disabled during tests — the suite legitimately fires many rapid
// signups/logins from the same address, and NODE_ENV=test is set
// automatically by Jest (see tests/setupEnv.js).
const isTestEnv = process.env.NODE_ENV === 'test';

function buildLimiter({ windowMs, max, message }) {
  if (isTestEnv) {
    return (req, res, next) => next();
  }
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: message },
  });
}

// Brute-force protection: a handful of wrong-password attempts is normal,
// dozens per minute from one address is not.
const loginLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many login attempts. Please try again later.',
});

// Mass-account-creation protection.
const signupLimiter = buildLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Too many accounts created from this address. Please try again later.',
});

module.exports = { loginLimiter, signupLimiter };
