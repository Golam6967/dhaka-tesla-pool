const request = require('supertest');
const { createApp } = require('../src/app');
const { pool: appPool } = require('../src/db/pool');
const {
  truncateAll,
  testPool,
  insertCorridor,
  insertZone,
} = require('./helpers/testDb');

const app = createApp();

let banani;
let mohakhali;
let gulshan1;

async function seedZones() {
  const corridorId = await insertCorridor('Banani-Gulshan-Mohakhali');
  // Same calibrated coordinates as scripts/seed.js / fare.service.test.js, so
  // the fare figures asserted below (e.g. 9000 paisa for 4km) are real.
  banani = { id: await insertZone({ name: 'Banani', corridorId, lat: 23.7936, lng: 90.4043 }) };
  mohakhali = {
    id: await insertZone({ name: 'Mohakhali', corridorId, lat: 23.7936, lng: 90.44357 }),
  };
  gulshan1 = {
    id: await insertZone({ name: 'Gulshan 1', corridorId, lat: 23.7936, lng: 90.43375 }),
  };
}

async function signup(role, overrides) {
  const path = role === 'driver' ? '/api/drivers/signup' : '/api/passengers/signup';
  const body =
    role === 'driver'
      ? { name: 'Jashim', phone: '+8801700000001', password: 'jashim-secret', teslaLabel: 'Bullet', teslaCapacity: 3, ...overrides }
      : { name: 'Nusrat', phone: '+8801700000002', password: 'nusrat-secret', ...overrides };

  const res = await request(app).post(path).send(body);
  return res.body;
}

describe('ride requests', () => {
  afterAll(async () => {
    await testPool.end();
    await appPool.end();
  });

  beforeEach(async () => {
    await truncateAll();
    await seedZones();
  });

  describe('POST /api/ride-requests', () => {
    it('creates a ride request for Nusrat with a no-discount fare estimate', async () => {
      const { token } = await signup('passenger');

      const res = await request(app)
        .post('/api/ride-requests')
        .set('Authorization', `Bearer ${token}`)
        .send({ pickupZoneId: banani.id, destinationZoneId: mohakhali.id, seatsRequested: 1 });

      expect(res.status).toBe(201);
      expect(res.body.rideRequest.status).toBe('requested');
      expect(res.body.fare.poolDiscountPaisa).toBe(0);
      expect(res.body.fare.totalFarePaisa).toBe(9000);
    });

    it('rejects the request with no Authorization header', async () => {
      const res = await request(app)
        .post('/api/ride-requests')
        .send({ pickupZoneId: banani.id, destinationZoneId: mohakhali.id, seatsRequested: 1 });

      expect(res.status).toBe(401);
    });

    it("rejects a driver's token — passenger-only operation", async () => {
      const { token } = await signup('driver');

      const res = await request(app)
        .post('/api/ride-requests')
        .set('Authorization', `Bearer ${token}`)
        .send({ pickupZoneId: banani.id, destinationZoneId: mohakhali.id, seatsRequested: 1 });

      expect(res.status).toBe(403);
    });

    it('rejects a non-UUID pickupZoneId', async () => {
      const { token } = await signup('passenger');

      const res = await request(app)
        .post('/api/ride-requests')
        .set('Authorization', `Bearer ${token}`)
        .send({ pickupZoneId: 'not-a-uuid', destinationZoneId: mohakhali.id, seatsRequested: 1 });

      expect(res.status).toBe(400);
    });

    it('rejects a non-positive seatsRequested', async () => {
      const { token } = await signup('passenger');

      const res = await request(app)
        .post('/api/ride-requests')
        .set('Authorization', `Bearer ${token}`)
        .send({ pickupZoneId: banani.id, destinationZoneId: mohakhali.id, seatsRequested: 0 });

      expect(res.status).toBe(400);
    });

    it('rejects a well-formed UUID that does not reference an existing zone', async () => {
      const { token } = await signup('passenger');
      const fakeZoneId = '00000000-0000-0000-0000-000000000000';

      const res = await request(app)
        .post('/api/ride-requests')
        .set('Authorization', `Bearer ${token}`)
        .send({ pickupZoneId: fakeZoneId, destinationZoneId: mohakhali.id, seatsRequested: 1 });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/ride-requests/:id', () => {
    it('lets Nusrat view her own ride request', async () => {
      const { token } = await signup('passenger');
      const createRes = await request(app)
        .post('/api/ride-requests')
        .set('Authorization', `Bearer ${token}`)
        .send({ pickupZoneId: banani.id, destinationZoneId: mohakhali.id, seatsRequested: 1 });

      const res = await request(app)
        .get(`/api/ride-requests/${createRes.body.rideRequest.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.rideRequest.id).toBe(createRes.body.rideRequest.id);
    });

    it("rejects Rafiq viewing Nusrat's ride request", async () => {
      const nusrat = await signup('passenger');
      const createRes = await request(app)
        .post('/api/ride-requests')
        .set('Authorization', `Bearer ${nusrat.token}`)
        .send({ pickupZoneId: banani.id, destinationZoneId: mohakhali.id, seatsRequested: 1 });

      const rafiq = await signup('passenger', { name: 'Rafiq', phone: '+8801700000003', password: 'rafiq-secret' });

      const res = await request(app)
        .get(`/api/ride-requests/${createRes.body.rideRequest.id}`)
        .set('Authorization', `Bearer ${rafiq.token}`);

      expect(res.status).toBe(403);
    });

    it('rejects a malformed id', async () => {
      const { token } = await signup('passenger');

      const res = await request(app)
        .get('/api/ride-requests/not-a-uuid')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
    });

    it('returns 404 for a well-formed id that does not exist', async () => {
      const { token } = await signup('passenger');
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const res = await request(app)
        .get(`/api/ride-requests/${fakeId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/ride-requests', () => {
    it("lists only the authenticated passenger's own ride requests", async () => {
      const nusrat = await signup('passenger');
      await request(app)
        .post('/api/ride-requests')
        .set('Authorization', `Bearer ${nusrat.token}`)
        .send({ pickupZoneId: banani.id, destinationZoneId: mohakhali.id, seatsRequested: 1 });

      const rafiq = await signup('passenger', { name: 'Rafiq', phone: '+8801700000003', password: 'rafiq-secret' });
      await request(app)
        .post('/api/ride-requests')
        .set('Authorization', `Bearer ${rafiq.token}`)
        .send({ pickupZoneId: banani.id, destinationZoneId: gulshan1.id, seatsRequested: 1 });

      const res = await request(app)
        .get('/api/ride-requests')
        .set('Authorization', `Bearer ${nusrat.token}`);

      expect(res.status).toBe(200);
      expect(res.body.rideRequests).toHaveLength(1);
      expect(res.body.rideRequests[0].destinationZoneId).toBe(mohakhali.id);
    });
  });
});
