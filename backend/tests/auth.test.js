const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createApp } = require('../src/app');
const { pool: appPool } = require('../src/db/pool');
const { truncateAll, testPool } = require('./helpers/testDb');

const app = createApp();

describe('passenger auth', () => {
  afterAll(async () => {
    await testPool.end();
    await appPool.end();
  });

  beforeEach(async () => {
    await truncateAll();
  });

  describe('POST /api/passengers/signup', () => {
    it("registers Nusrat and returns a token plus her public profile", async () => {
      const res = await request(app).post('/api/passengers/signup').send({
        name: 'Nusrat',
        phone: '+8801700000002',
        password: 'nusrat-secret',
      });

      expect(res.status).toBe(201);
      expect(res.body.token).toEqual(expect.any(String));
      expect(res.body.user).toMatchObject({
        name: 'Nusrat',
        phone: '+8801700000002',
        role: 'passenger',
      });
      expect(res.body.user.password_hash).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toMatch(/nusrat-secret/);

      const payload = jwt.decode(res.body.token);
      expect(payload.role).toBe('passenger');
      expect(payload.sub).toBe(res.body.user.id);
    });

    it('rejects signup with a phone number that is already registered', async () => {
      await request(app).post('/api/passengers/signup').send({
        name: 'Rafiq',
        phone: '+8801700000003',
        password: 'rafiq-secret',
      });

      const res = await request(app).post('/api/passengers/signup').send({
        name: 'Rafiq',
        phone: '+8801700000003',
        password: 'another-password',
      });

      expect(res.status).toBe(409);
    });

    it('rejects signup with a password shorter than 6 characters', async () => {
      const res = await request(app).post('/api/passengers/signup').send({
        name: 'Shirin',
        phone: '+8801700000004',
        password: '123',
      });

      expect(res.status).toBe(400);
    });

    it('ignores a client-supplied role and always registers as passenger', async () => {
      const res = await request(app).post('/api/passengers/signup').send({
        name: 'Shirin',
        phone: '+8801700000004',
        password: 'shirin-secret',
        role: 'driver',
      });

      expect(res.status).toBe(201);
      expect(res.body.user.role).toBe('passenger');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/passengers/signup').send({
        name: 'Nusrat',
        phone: '+8801700000002',
        password: 'nusrat-secret',
      });
    });

    it('logs Nusrat in with the correct password', async () => {
      const res = await request(app).post('/api/auth/login').send({
        phone: '+8801700000002',
        password: 'nusrat-secret',
      });

      expect(res.status).toBe(200);
      expect(res.body.token).toEqual(expect.any(String));
      expect(res.body.user.phone).toBe('+8801700000002');
    });

    it('rejects login with the wrong password', async () => {
      const res = await request(app).post('/api/auth/login').send({
        phone: '+8801700000002',
        password: 'wrong-password',
      });

      expect(res.status).toBe(401);
    });

    it('rejects login for a phone number that was never registered', async () => {
      const res = await request(app).post('/api/auth/login').send({
        phone: '+8801799999999',
        password: 'irrelevant',
      });

      expect(res.status).toBe(401);
    });
  });
});
