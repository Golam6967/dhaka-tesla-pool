const request = require('supertest');
const { createApp } = require('../src/app');
const { pool: appPool } = require('../src/db/pool');
const { truncateAll, testPool, insertCorridor, insertZone } = require('./helpers/testDb');

// Consolidated cross-cutting authorization checks (PDF §12). Most ownership
// rules are also exercised inline in their owning feature's test file
// (ride-request.test.js, driver-flow.test.js, cancellation.test.js) — this
// file specifically proves the driver-view gap found and fixed on this
// branch: a driver could previously view ANY ride request system-wide via
// GET /api/ride-requests/:id, not just ones on their own Tesla.

const app = createApp();

let banani;
let mohakhali;

async function seedZones() {
  const corridorId = await insertCorridor('Banani-Gulshan-Mohakhali');
  banani = { id: await insertZone({ name: 'Banani', corridorId, lat: 23.7936, lng: 90.4043 }) };
  mohakhali = {
    id: await insertZone({ name: 'Mohakhali', corridorId, lat: 23.7936, lng: 90.44357 }),
  };
}

async function signupDriver(overrides = {}) {
  const res = await request(app)
    .post('/api/drivers/signup')
    .send({
      name: 'Jashim',
      phone: '+8801700000001',
      password: 'jashim-secret',
      teslaLabel: 'Bullet',
      teslaCapacity: 3,
      ...overrides,
    });
  return res.body;
}

async function signupPassenger(overrides = {}) {
  const res = await request(app)
    .post('/api/passengers/signup')
    .send({
      name: 'Nusrat',
      phone: '+8801700000002',
      password: 'nusrat-secret',
      ...overrides,
    });
  return res.body;
}

async function goOnline(driverToken) {
  await request(app)
    .patch('/api/drivers/me/status')
    .set('Authorization', `Bearer ${driverToken}`)
    .send({ status: 'online' });
}

async function createRideRequest(passengerToken) {
  const res = await request(app)
    .post('/api/ride-requests')
    .set('Authorization', `Bearer ${passengerToken}`)
    .send({ pickupZoneId: banani.id, destinationZoneId: mohakhali.id, seatsRequested: 1 });
  return res.body.rideRequest;
}

async function accept(driverToken, rideRequestId) {
  return request(app)
    .post('/api/pools/accept')
    .set('Authorization', `Bearer ${driverToken}`)
    .send({ rideRequestId });
}

describe('cross-cutting authorization', () => {
  afterAll(async () => {
    await testPool.end();
    await appPool.end();
  });

  beforeEach(async () => {
    await truncateAll();
    await seedZones();
  });

  it('lets a driver view a ride request that is on their own Tesla', async () => {
    const driver = await signupDriver();
    await goOnline(driver.token);
    const nusrat = await signupPassenger();
    const rideRequest = await createRideRequest(nusrat.token);
    await accept(driver.token, rideRequest.id);

    const res = await request(app)
      .get(`/api/ride-requests/${rideRequest.id}`)
      .set('Authorization', `Bearer ${driver.token}`);

    expect(res.status).toBe(200);
  });

  it('rejects a driver viewing an unmatched ride request (regression: previously allowed system-wide)', async () => {
    const driver = await signupDriver();
    const nusrat = await signupPassenger();
    const rideRequest = await createRideRequest(nusrat.token);

    const res = await request(app)
      .get(`/api/ride-requests/${rideRequest.id}`)
      .set('Authorization', `Bearer ${driver.token}`);

    expect(res.status).toBe(403);
  });

  it("rejects a driver viewing a ride request matched to a different driver's Tesla", async () => {
    const driver = await signupDriver();
    await goOnline(driver.token);
    const nusrat = await signupPassenger();
    const rideRequest = await createRideRequest(nusrat.token);
    await accept(driver.token, rideRequest.id);

    const otherDriver = await signupDriver({
      name: 'Karim',
      phone: '+8801700000009',
      teslaLabel: 'Volt',
    });

    const res = await request(app)
      .get(`/api/ride-requests/${rideRequest.id}`)
      .set('Authorization', `Bearer ${otherDriver.token}`);

    expect(res.status).toBe(403);
  });

  it('rejects an unauthenticated request to every protected route with 401, not a crash', async () => {
    const protectedGets = ['/api/ride-requests', '/api/drivers/me/available-requests'];
    for (const path of protectedGets) {
      const res = await request(app).get(path);
      expect(res.status).toBe(401);
    }
  });
});
