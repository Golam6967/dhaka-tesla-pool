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

async function createRideRequest(passengerToken, { pickupZoneId, destinationZoneId, seatsRequested }) {
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

describe('pool matching and concurrency', () => {
  afterAll(async () => {
    await testPool.end();
    await appPool.end();
  });

  beforeEach(async () => {
    await truncateAll();
    await seedZones();
  });

  it('matches Nusrat into a new pool and applies no discount for a solo member', async () => {
    const driver = await signupDriver();
    await goOnline(driver.token);
    const nusrat = await signupPassenger();
    const rideRequest = await createRideRequest(nusrat.token, {
      pickupZoneId: banani.id,
      destinationZoneId: mohakhali.id,
      seatsRequested: 1,
    });

    const res = await accept(driver.token, rideRequest.id);

    expect(res.status).toBe(200);
    expect(res.body.pool.seatsOccupied).toBe(1);
    expect(res.body.rideRequest.status).toBe('matched');
    expect(res.body.fare.poolDiscountPaisa).toBe(0);
    expect(res.body.fare.totalFarePaisa).toBe(9000);
  });

  it("matches Rafiq into Nusrat's pool and retroactively discounts both fares (worked example)", async () => {
    const driver = await signupDriver();
    await goOnline(driver.token);
    const nusrat = await signupPassenger();
    const rafiq = await signupPassenger({ name: 'Rafiq', phone: '+8801700000003', password: 'rafiq-secret' });

    const nusratRequest = await createRideRequest(nusrat.token, {
      pickupZoneId: banani.id,
      destinationZoneId: mohakhali.id,
      seatsRequested: 1,
    });
    const rafiqRequest = await createRideRequest(rafiq.token, {
      pickupZoneId: banani.id,
      destinationZoneId: gulshan1.id,
      seatsRequested: 1,
    });

    await accept(driver.token, nusratRequest.id);
    const secondJoin = await accept(driver.token, rafiqRequest.id);

    expect(secondJoin.status).toBe(200);
    expect(secondJoin.body.pool.seatsOccupied).toBe(2);
    expect(secondJoin.body.fare.totalFarePaisa).toBe(6000); // Rafiq

    const nusratView = await request(app)
      .get(`/api/ride-requests/${nusratRequest.id}`)
      .set('Authorization', `Bearer ${nusrat.token}`);
    expect(nusratView.body.fare.totalFarePaisa).toBe(7200); // retroactively discounted
    expect(nusratView.body.fare.poolDiscountPaisa).toBe(1800);
  });

  it('rejects a ride request with an incompatible pickup zone', async () => {
    const driver = await signupDriver();
    await goOnline(driver.token);
    const nusrat = await signupPassenger();
    const shirin = await signupPassenger({ name: 'Shirin', phone: '+8801700000004', password: 'shirin-secret' });

    const nusratRequest = await createRideRequest(nusrat.token, {
      pickupZoneId: banani.id,
      destinationZoneId: mohakhali.id,
      seatsRequested: 1,
    });
    // Incompatible: pickup at Gulshan 1 instead of Banani.
    const shirinRequest = await createRideRequest(shirin.token, {
      pickupZoneId: gulshan1.id,
      destinationZoneId: mohakhali.id,
      seatsRequested: 1,
    });

    await accept(driver.token, nusratRequest.id);
    const res = await accept(driver.token, shirinRequest.id);

    expect(res.status).toBe(400);
  });

  it('rejects accepting a ride request that is not in requested status', async () => {
    const driver = await signupDriver();
    await goOnline(driver.token);
    const nusrat = await signupPassenger();
    const rideRequest = await createRideRequest(nusrat.token, {
      pickupZoneId: banani.id,
      destinationZoneId: mohakhali.id,
      seatsRequested: 1,
    });

    await accept(driver.token, rideRequest.id);
    const res = await accept(driver.token, rideRequest.id);

    expect(res.status).toBe(400);
  });

  it('rejects a passenger token calling the driver-only accept endpoint', async () => {
    const driver = await signupDriver();
    await goOnline(driver.token);
    const nusrat = await signupPassenger();
    const rideRequest = await createRideRequest(nusrat.token, {
      pickupZoneId: banani.id,
      destinationZoneId: mohakhali.id,
      seatsRequested: 1,
    });

    const res = await request(app)
      .post('/api/pools/accept')
      .set('Authorization', `Bearer ${nusrat.token}`)
      .send({ rideRequestId: rideRequest.id });

    expect(res.status).toBe(403);
  });

  it('rejects accepting a request while the Tesla is offline', async () => {
    const driver = await signupDriver(); // offline by default
    const nusrat = await signupPassenger();
    const rideRequest = await createRideRequest(nusrat.token, {
      pickupZoneId: banani.id,
      destinationZoneId: mohakhali.id,
      seatsRequested: 1,
    });

    const res = await accept(driver.token, rideRequest.id);

    expect(res.status).toBe(400);
  });

  it('the last seat: two concurrent claims on a 1-seat-remaining pool result in exactly one success (architecture.md §4a)', async () => {
    const driver = await signupDriver(); // Bullet, capacity 3
    await goOnline(driver.token);
    const nusrat = await signupPassenger();
    const rafiq = await signupPassenger({ name: 'Rafiq', phone: '+8801700000003', password: 'rafiq-secret' });
    const shirin = await signupPassenger({ name: 'Shirin', phone: '+8801700000004', password: 'shirin-secret' });

    // Nusrat takes 2 of Bullet's 3 seats, leaving exactly 1.
    const nusratRequest = await createRideRequest(nusrat.token, {
      pickupZoneId: banani.id,
      destinationZoneId: mohakhali.id,
      seatsRequested: 2,
    });
    await accept(driver.token, nusratRequest.id);

    const rafiqRequest = await createRideRequest(rafiq.token, {
      pickupZoneId: banani.id,
      destinationZoneId: gulshan1.id,
      seatsRequested: 1,
    });
    const shirinRequest = await createRideRequest(shirin.token, {
      pickupZoneId: banani.id,
      destinationZoneId: gulshan1.id,
      seatsRequested: 1,
    });

    const [rafiqResult, shirinResult] = await Promise.all([
      accept(driver.token, rafiqRequest.id),
      accept(driver.token, shirinRequest.id),
    ]);

    const statuses = [rafiqResult.status, shirinResult.status].sort();
    expect(statuses).toEqual([200, 409]);

    const { rows } = await testPool.query('SELECT seats_occupied FROM pools WHERE tesla_id = $1', [
      driver.tesla.id,
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].seats_occupied).toBe(3); // never exceeds Bullet's capacity
  });

  it('concurrent pool creation for the same Tesla never produces two pools (architecture.md §4b)', async () => {
    const driver = await signupDriver();
    await goOnline(driver.token);
    const nusrat = await signupPassenger();
    const rafiq = await signupPassenger({ name: 'Rafiq', phone: '+8801700000003', password: 'rafiq-secret' });

    const nusratRequest = await createRideRequest(nusrat.token, {
      pickupZoneId: banani.id,
      destinationZoneId: mohakhali.id,
      seatsRequested: 1,
    });
    const rafiqRequest = await createRideRequest(rafiq.token, {
      pickupZoneId: banani.id,
      destinationZoneId: gulshan1.id,
      seatsRequested: 1,
    });

    // Neither request has been accepted yet, so no pool exists for this
    // Tesla — both accept calls race to create the first one.
    const [nusratResult, rafiqResult] = await Promise.all([
      accept(driver.token, nusratRequest.id),
      accept(driver.token, rafiqRequest.id),
    ]);

    expect(nusratResult.status).toBe(200);
    expect(rafiqResult.status).toBe(200);
    expect(nusratResult.body.pool.id).toBe(rafiqResult.body.pool.id);

    const { rows } = await testPool.query('SELECT id FROM pools WHERE tesla_id = $1', [
      driver.tesla.id,
    ]);
    expect(rows).toHaveLength(1);
  });
});
