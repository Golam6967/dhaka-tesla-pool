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

function cancel(passengerToken, rideRequestId) {
  return request(app)
    .post(`/api/ride-requests/${rideRequestId}/cancel`)
    .set('Authorization', `Bearer ${passengerToken}`)
    .send();
}

describe('cancellation', () => {
  afterAll(async () => {
    await testPool.end();
    await appPool.end();
  });

  beforeEach(async () => {
    await truncateAll();
    await seedZones();
  });

  it('allows cancelling a ride request that is still just requested', async () => {
    const nusrat = await signupPassenger();
    const rideRequest = await createRideRequest(nusrat.token, {
      pickupZoneId: banani.id,
      destinationZoneId: mohakhali.id,
    });

    const res = await cancel(nusrat.token, rideRequest.id);

    expect(res.status).toBe(200);
    expect(res.body.rideRequest.status).toBe('cancelled');
  });

  it('allows cancelling a matched (solo pool) ride and cancels the now-empty pool', async () => {
    const driver = await signupDriver();
    await goOnline(driver.token);
    const nusrat = await signupPassenger();
    const rideRequest = await createRideRequest(nusrat.token, {
      pickupZoneId: banani.id,
      destinationZoneId: mohakhali.id,
    });
    await accept(driver.token, rideRequest.id);

    const res = await cancel(nusrat.token, rideRequest.id);

    expect(res.status).toBe(200);
    expect(res.body.rideRequest.status).toBe('cancelled');

    const { rows } = await testPool.query('SELECT status, seats_occupied FROM pools WHERE tesla_id = $1', [
      driver.tesla.id,
    ]);
    expect(rows[0].status).toBe('cancelled');
    expect(rows[0].seats_occupied).toBe(0);
  });

  it('removes the cancelling member from a 2-person pool and reverts the remaining fare to no-discount', async () => {
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
    await accept(driver.token, rafiqRequest.id); // pool now has 2 members, both discounted

    const res = await cancel(rafiq.token, rafiqRequest.id);
    expect(res.status).toBe(200);

    const { rows } = await testPool.query('SELECT status, seats_occupied FROM pools WHERE tesla_id = $1', [
      driver.tesla.id,
    ]);
    expect(rows[0].status).not.toBe('cancelled'); // still has Nusrat
    expect(rows[0].seats_occupied).toBe(1);

    const nusratView = await request(app)
      .get(`/api/ride-requests/${nusratRequest.id}`)
      .set('Authorization', `Bearer ${nusrat.token}`);
    expect(nusratView.body.fare.poolDiscountPaisa).toBe(0);
    expect(nusratView.body.fare.totalFarePaisa).toBe(9000); // back to solo rate
  });

  it('rejects cancellation once the driver has arrived', async () => {
    const driver = await signupDriver();
    await goOnline(driver.token);
    const nusrat = await signupPassenger();
    const rideRequest = await createRideRequest(nusrat.token, {
      pickupZoneId: banani.id,
      destinationZoneId: mohakhali.id,
    });
    await accept(driver.token, rideRequest.id);
    await driverAction(driver.token, rideRequest.id, 'arrive');

    const res = await cancel(nusrat.token, rideRequest.id);
    expect(res.status).toBe(400);
  });

  it('rejects cancellation once the ride has started', async () => {
    const driver = await signupDriver();
    await goOnline(driver.token);
    const nusrat = await signupPassenger();
    const rideRequest = await createRideRequest(nusrat.token, {
      pickupZoneId: banani.id,
      destinationZoneId: mohakhali.id,
    });
    await accept(driver.token, rideRequest.id);
    await driverAction(driver.token, rideRequest.id, 'arrive');
    await driverAction(driver.token, rideRequest.id, 'start');

    const res = await cancel(nusrat.token, rideRequest.id);
    expect(res.status).toBe(400);
  });

  it('rejects cancellation of an already-completed ride', async () => {
    const driver = await signupDriver();
    await goOnline(driver.token);
    const nusrat = await signupPassenger();
    const rideRequest = await createRideRequest(nusrat.token, {
      pickupZoneId: banani.id,
      destinationZoneId: mohakhali.id,
    });
    await accept(driver.token, rideRequest.id);
    await driverAction(driver.token, rideRequest.id, 'arrive');
    await driverAction(driver.token, rideRequest.id, 'start');
    await driverAction(driver.token, rideRequest.id, 'complete');

    const res = await cancel(nusrat.token, rideRequest.id);
    expect(res.status).toBe(400);
  });

  it("rejects Rafiq cancelling Nusrat's ride", async () => {
    const nusrat = await signupPassenger();
    const rafiq = await signupPassenger({ name: 'Rafiq', phone: '+8801700000003', password: 'rafiq-secret' });
    const rideRequest = await createRideRequest(nusrat.token, {
      pickupZoneId: banani.id,
      destinationZoneId: mohakhali.id,
    });

    const res = await cancel(rafiq.token, rideRequest.id);
    expect(res.status).toBe(403);
  });

  it('rejects a driver token calling the passenger-only cancel endpoint', async () => {
    const driver = await signupDriver();
    const nusrat = await signupPassenger();
    const rideRequest = await createRideRequest(nusrat.token, {
      pickupZoneId: banani.id,
      destinationZoneId: mohakhali.id,
    });

    const res = await cancel(driver.token, rideRequest.id);
    expect(res.status).toBe(403);
  });
});
