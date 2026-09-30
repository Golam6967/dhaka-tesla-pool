const request = require('supertest');
const { createApp } = require('../src/app');
const { pool: appPool } = require('../src/db/pool');
const driverService = require('../src/services/driver.service');
const { truncateAll, testPool } = require('./helpers/testDb');

const app = createApp();

async function signupDriver(overrides = {}) {
  return request(app)
    .post('/api/drivers/signup')
    .send({
      name: 'Jashim',
      phone: '+8801700000001',
      password: 'jashim-secret',
      teslaLabel: 'Bullet',
      teslaCapacity: 3,
      ...overrides,
    });
}

async function signupPassenger(overrides = {}) {
  return request(app)
    .post('/api/passengers/signup')
    .send({
      name: 'Nusrat',
      phone: '+8801700000002',
      password: 'nusrat-secret',
      ...overrides,
    });
}

describe('driver auth', () => {
  afterAll(async () => {
    await testPool.end();
    await appPool.end();
  });

  beforeEach(async () => {
    await truncateAll();
  });

  describe('POST /api/drivers/signup', () => {
    it('registers Jashim with Bullet and returns token, user, and tesla', async () => {
      const res = await signupDriver();

      expect(res.status).toBe(201);
      expect(res.body.token).toEqual(expect.any(String));
      expect(res.body.user).toMatchObject({ name: 'Jashim', role: 'driver' });
      expect(res.body.tesla).toMatchObject({ label: 'Bullet', capacity: 3, status: 'offline' });
      expect(res.body.user.password_hash).toBeUndefined();
    });

    it('rejects signup with a phone number that is already registered', async () => {
      await signupDriver();
      const res = await signupDriver();

      expect(res.status).toBe(409);
    });

    it('rejects concurrent signups with the same phone number cleanly, not with a raw DB error', async () => {
      const [first, second] = await Promise.all([signupDriver(), signupDriver({ teslaLabel: 'Volt' })]);
      const statuses = [first.status, second.status].sort();

      expect(statuses).toEqual([201, 409]);
      const loser = first.status === 409 ? first : second;
      expect(loser.body.error).toMatch(/already exists/i);
    });

    it('rejects signup with a non-positive Tesla capacity', async () => {
      const res = await signupDriver({ teslaCapacity: 0 });

      expect(res.status).toBe(400);
    });

    it('rejects a Tesla capacity above the cap of 8', async () => {
      const res = await signupDriver({ teslaCapacity: 9 });

      expect(res.status).toBe(400);
    });

    it('rolls back user creation if the Tesla insert fails at the DB layer (atomic signup)', async () => {
      // Calls the service directly, bypassing Zod, so it's the database's own
      // positive_capacity CHECK constraint that fails inside the transaction —
      // proving the user row does not survive when the Tesla insert fails.
      await expect(
        driverService.signup({
          name: 'Jashim',
          phone: '+8801700000001',
          password: 'jashim-secret',
          teslaLabel: 'Bullet',
          teslaCapacity: 0,
        })
      ).rejects.toThrow(/positive_capacity/);

      const { rows } = await testPool.query('SELECT * FROM users WHERE phone = $1', [
        '+8801700000001',
      ]);
      expect(rows).toHaveLength(0);
    });
  });

  describe('PATCH /api/drivers/me/status', () => {
    it("toggles Bullet's status to online for the authenticated driver", async () => {
      const signupRes = await signupDriver();
      const token = signupRes.body.token;

      const res = await request(app)
        .patch('/api/drivers/me/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'online' });

      expect(res.status).toBe(200);
      expect(res.body.tesla.status).toBe('online');
    });

    it('rejects the request with no Authorization header', async () => {
      const res = await request(app).patch('/api/drivers/me/status').send({ status: 'online' });

      expect(res.status).toBe(401);
    });

    it("rejects a passenger's token — driver-only operation", async () => {
      const signupRes = await signupPassenger();
      const token = signupRes.body.token;

      const res = await request(app)
        .patch('/api/drivers/me/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'online' });

      expect(res.status).toBe(403);
    });

    it('rejects an invalid status value', async () => {
      const signupRes = await signupDriver();
      const token = signupRes.body.token;

      const res = await request(app)
        .patch('/api/drivers/me/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'parked' });

      expect(res.status).toBe(400);
    });
  });
});
