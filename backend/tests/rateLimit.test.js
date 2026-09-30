const request = require('supertest');
const express = require('express');

// The limiter is a no-op in the test env (see rateLimit.js) so the rest of
// the suite isn't throttled. This test proves it actually engages outside
// that env by loading a fresh copy with NODE_ENV forced elsewhere.
describe('rateLimit (outside test env)', () => {
  let restoreEnv;

  beforeEach(() => {
    restoreEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    jest.resetModules();
  });

  afterEach(() => {
    process.env.NODE_ENV = restoreEnv;
    jest.resetModules();
  });

  it('returns 429 after exceeding the login attempt limit', async () => {
    const { loginLimiter } = require('../src/middleware/rateLimit');
    const app = express();
    app.get('/test-login', loginLimiter, (req, res) => res.status(200).json({ ok: true }));

    let lastStatus;
    for (let i = 0; i < 11; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const res = await request(app).get('/test-login');
      lastStatus = res.status;
    }

    expect(lastStatus).toBe(429);
  });
});
