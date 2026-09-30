const jwt = require('jsonwebtoken');

const JWT_EXPIRES_IN = '8h';
const JWT_ALGORITHM = 'HS256';

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    algorithm: JWT_ALGORITHM,
  });
}

function verifyToken(token) {
  // Explicitly restricting to HS256 (rather than letting the library infer
  // it) is defense in depth against algorithm-confusion attacks — a token
  // crafted with a different algorithm is rejected outright, not just
  // implicitly disallowed.
  return jwt.verify(token, process.env.JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
}

module.exports = { signToken, verifyToken };
