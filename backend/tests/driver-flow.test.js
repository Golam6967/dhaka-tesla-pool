const request = require('supertest');
const { createApp } = require('../src/app');
const { pool: appPool } = require('../src/db/pool');
const { truncateAll, testPool, insertCorridor, insertZone } = require('./helpers/testDb');

const app = createApp();

let banani;
let mohakhali;
let gulshan1;

async function seedZones() {
  const corridorId = await insertCorridor('Banani-Gulshan-Mohakhali');
  banani = { id: await insertZone({ name: 'Banani', corridorId, lat: 23.7936, lng: 90.4043 }) };
  mohakhali = {
    id: await insertZone({ name: 'Mohakhali', corridorId, lat: 23.7936, lng: 90.44357 }),
  };
  gulshan1 = {
    id: await insertZone({ name: 'Gulshan 1', corridorId, lat: 23.7936, lng: 90.43375 }),
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

async function createRideRequest(passengerToken, { pickupZoneId, destinationZoneId, seatsRequested = 1 }) {
  const res = await request(app)
    .post('/api/ride-requests')
    .set('Authorization', `Bearer ${passengerToken}`)
    .send({ pickupZoneId, destinationZoneId, seatsRequested });
  return res.body.rideRequest;
}

async function accept(driverToken, rideRequestId) {
  return request(app)
    .post('/api/pools/accept')
    .set('Authorization', `Bearer ${driverToken}`)
    .send({ rideRequestId });
}

function driverAction(driverToken, rideRequestId, action) {
  return request(app)
    .post(`/api/ride-requests/${rideRequestId}/${action}`)
    .set('Authorization', `Bearer ${driverToken}`)
    .send();
}

describe('driver flow', () => {
  afterAll(async () => {
    await testPool.end();
    await appPool.end();
  });

  beforeEach(async () => {
    await truncateAll();
    await seedZones();
  });

  describe('GET /api/drivers/me/available-requests', () => {
    it('lists pending requests that fit capacity when the driver has no pool yet', async () => {
      const driver = await signupDriver();
      const nusrat = await signupPassenger();
      await createRideRequest(nusrat.token, { pickupZoneId: banani.id, destinationZoneId: mohakhali.id });

      const res = await request(app)
        .get('/api/drivers/me/available-requests')
        .set('Authorization', `Bearer ${driver.token}`);

      expect(res.status).toBe(200);
      expect(res.body.rideRequests).toHaveLength(1);
    });

    it('filters out requests incompatible with an existing forming pool', async () => {
      const driver = await signupDriver();
      await goOnline(driver.token);
      const nusrat = await signupPassenger();
      const shirin = await signupPassenger({ name: 'Shirin', phone: '+8801700000004', password: 'shirin-secret' });

      const nusratRequest = await createRideRequest(nusrat.token, {
        pickupZoneId: banani.id,
        destinationZoneId: mohakhali.id,
      });
      await accept(driver.token, nusratRequest.id);

      // Incompatible: different pickup zone.
      await createRideRequest(shirin.token, { pickupZoneId: gulshan1.id, destinationZoneId: mohakhali.id });

      const res = await request(app)
        .get('/api/drivers/me/available-requests')
        .set('Authorization', `Bearer ${driver.token}`);

      expect(res.status).toBe(200);
      expect(res.body.rideRequests).toHaveLength(0);
    });

    it('rejects a passenger token', async () => {
      const nusrat = await signupPassenger();

      const res = await request(app)
        .get('/api/drivers/me/available-requests')
        .set('Authorization', `Bearer ${nusrat.token}`);

      expect(res.status).toBe(403);
    });
  });

  describe('ride timeline: arrive -> start -> complete', () => {
    it('runs the full happy path and activates then completes the pool', async () => {
      const driver = await signupDriver();
      await goOnline(driver.token);
      const nusrat = await signupPassenger();
      const rideRequest = await createRideRequest(nusrat.token, {
        pickupZoneId: banani.id,
        destinationZoneId: mohakhali.id,
      });
      await accept(driver.token, rideRequest.id);

      const arrived = await driverAction(driver.token, rideRequest.id, 'arrive');
      expect(arrived.status).toBe(200);
      expect(arrived.body.rideRequest.status).toBe('driver_arrived');

      const started = await driverAction(driver.token, rideRequest.id, 'start');
      expect(started.status).toBe(200);
      expect(started.body.rideRequest.status).toBe('started');

      const { rows: poolAfterStart } = await testPool.query(
        'SELECT status FROM pools WHERE tesla_id = $1',
        [driver.tesla.id]
      );
      expect(poolAfterStart[0].status).toBe('active');

      const completed = await driverAction(driver.token, rideRequest.id, 'complete');
      expect(completed.status).toBe(200);
      expect(completed.body.rideRequest.status).toBe('completed');

      const { rows: poolAfterComplete } = await testPool.query(
        'SELECT status FROM pools WHERE tesla_id = $1',
        [driver.tesla.id]
      );
      expect(poolAfterComplete[0].status).toBe('completed');
    });

    it('only completes the pool once every member has completed', async () => {
      const driver = await signupDriver();
      await goOnline(driver.token);
      const nusrat = await signupPassenger();
      const rafiq = await signupPassenger({ name: 'Rafiq', phone: '+8801700000003', password: 'rafiq-secret' });

      const nusratRequest = await createRideRequest(nusrat.token, {
        pickupZoneId: banani.id,
        destinationZoneId: mohakhali.id,
      });
      const rafiqRequest = await createRideRequest(rafiq.token, {
        pickupZoneId: banani.id,
        destinationZoneId: gulshan1.id,
      });
      await accept(driver.token, nusratRequest.id);
      await accept(driver.token, rafiqRequest.id);

      await driverAction(driver.token, nusratRequest.id, 'arrive');
      await driverAction(driver.token, rafiqRequest.id, 'arrive');
      await driverAction(driver.token, nusratRequest.id, 'start');
      await driverAction(driver.token, rafiqRequest.id, 'start');

      // Rafiq (Gulshan 1) completes first — pool should still be active.
      await driverAction(driver.token, rafiqRequest.id, 'complete');
      const { rows: midway } = await testPool.query('SELECT status FROM pools WHERE tesla_id = $1', [
        driver.tesla.id,
      ]);
      expect(midway[0].status).toBe('active');

      await driverAction(driver.token, nusratRequest.id, 'complete');
      const { rows: final } = await testPool.query('SELECT status FROM pools WHERE tesla_id = $1', [
        driver.tesla.id,
      ]);
      expect(final[0].status).toBe('completed');
    });

    it('rejects starting a ride before it has been marked arrived', async () => {
      const driver = await signupDriver();
      await goOnline(driver.token);
      const nusrat = await signupPassenger();
      const rideRequest = await createRideRequest(nusrat.token, {
        pickupZoneId: banani.id,
        destinationZoneId: mohakhali.id,
      });
      await accept(driver.token, rideRequest.id);

      const res = await driverAction(driver.token, rideRequest.id, 'start');
      expect(res.status).toBe(400);
    });

    it("rejects a different driver operating on someone else's ride", async () => {
      const driver = await signupDriver();
      await goOnline(driver.token);
      const nusrat = await signupPassenger();
      const rideRequest = await createRideRequest(nusrat.token, {
        pickupZoneId: banani.id,
        destinationZoneId: mohakhali.id,
      });
      await accept(driver.token, rideRequest.id);

      const otherDriver = await signupDriver({
        name: 'Karim',
        phone: '+8801700000009',
        teslaLabel: 'Volt',
      });

      const res = await driverAction(otherDriver.token, rideRequest.id, 'arrive');
      expect(res.status).toBe(403);
    });

    it('rejects a passenger token calling a driver-only transition', async () => {
      const driver = await signupDriver();
      await goOnline(driver.token);
      const nusrat = await signupPassenger();
      const rideRequest = await createRideRequest(nusrat.token, {
        pickupZoneId: banani.id,
        destinationZoneId: mohakhali.id,
      });
      await accept(driver.token, rideRequest.id);

      const res = await request(app)
        .post(`/api/ride-requests/${rideRequest.id}/arrive`)
        .set('Authorization', `Bearer ${nusrat.token}`)
        .send();

      expect(res.status).toBe(403);
    });
  });
});
