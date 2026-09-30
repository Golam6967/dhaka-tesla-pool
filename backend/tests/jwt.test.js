const jwt = require('jsonwebtoken');
const { signToken, verifyToken } = require('../src/config/jwt');

describe('jwt config', () => {
  it('signs and verifies a token round-trip', () => {
    const token = signToken({ id: 'user-1', role: 'passenger' });
    const payload = verifyToken(token);

    expect(payload.sub).toBe('user-1');
    expect(payload.role).toBe('passenger');
  });

  it('rejects a token signed with a different algorithm than HS256', () => {
    // A token crafted with 'none' (no signature at all) must never verify —
    // proves algorithms are actually restricted, not just implicitly assumed.
    const forgedToken = jwt.sign({ sub: 'attacker', role: 'driver' }, '', {
      algorithm: 'none',
    });

    expect(() => verifyToken(forgedToken)).toThrow();
  });

  it('rejects a token signed with the correct secret but a different algorithm', () => {
    // Some jwt libraries let 'none' be filtered but still mix up HS/RS
    // families; pin down the exact declared algorithm too.
    const differentAlgToken = jwt.sign({ sub: 'user-1', role: 'passenger' }, process.env.JWT_SECRET, {
      algorithm: 'HS384',
    });

    expect(() => verifyToken(differentAlgToken)).toThrow();
  });
});
