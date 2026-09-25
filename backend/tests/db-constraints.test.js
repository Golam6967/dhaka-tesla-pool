const {
  testPool,
  truncateAll,
  insertUser,
  insertTesla,
  insertCorridor,
  insertZone,
  insertRideRequest,
  insertPool,
} = require('./helpers/testDb');

// These tests prove the invariants from architecture.md §2 / PDF §6 are
// enforced by the database itself — not just by application code that a
// future bug could bypass.

describe('database-level invariants', () => {
  afterAll(async () => {
    await testPool.end();
  });

  beforeEach(async () => {
    await truncateAll();
  });

  it('rejects a Tesla with non-positive capacity', async () => {
    const jashimId = await insertUser({ name: 'Jashim', phone: '+8801700000001', role: 'driver' });

    await expect(
      insertTesla({ driverId: jashimId, label: 'Bullet', capacity: 0 })
    ).rejects.toThrow(/positive_capacity/);
  });

  it('rejects a ride request with non-positive seats_requested', async () => {
    const nusratId = await insertUser({ name: 'Nusrat', phone: '+8801700000002', role: 'passenger' });
    const corridorId = await insertCorridor('Banani-Gulshan-Mohakhali');
    const banani = await insertZone({ name: 'Banani', corridorId });
    const mohakhali = await insertZone({ name: 'Mohakhali', corridorId });

    await expect(
      insertRideRequest({
        passengerId: nusratId,
        pickupZoneId: banani,
        destinationZoneId: mohakhali,
        seatsRequested: 0,
      })
    ).rejects.toThrow(/positive_seats_requested/);
  });

  it('rejects a pool with negative seats_occupied', async () => {
    const jashimId = await insertUser({ name: 'Jashim', phone: '+8801700000001', role: 'driver' });
    const bulletId = await insertTesla({ driverId: jashimId, label: 'Bullet', capacity: 3 });

    await expect(
      insertPool({ teslaId: bulletId, seatsOccupied: -1 })
    ).rejects.toThrow(/seats_within_capacity/);
  });

  it('rejects a second forming/active pool for the same Tesla (one_active_pool_per_tesla)', async () => {
    const jashimId = await insertUser({ name: 'Jashim', phone: '+8801700000001', role: 'driver' });
    const bulletId = await insertTesla({ driverId: jashimId, label: 'Bullet', capacity: 3 });

    await insertPool({ teslaId: bulletId, status: 'forming' });

    await expect(
      insertPool({ teslaId: bulletId, status: 'forming' })
    ).rejects.toThrow(/one_active_pool_per_tesla/);
  });

  it('allows a new pool for a Tesla once its previous pool is completed', async () => {
    const jashimId = await insertUser({ name: 'Jashim', phone: '+8801700000001', role: 'driver' });
    const bulletId = await insertTesla({ driverId: jashimId, label: 'Bullet', capacity: 3 });

    await insertPool({ teslaId: bulletId, status: 'completed' });

    await expect(insertPool({ teslaId: bulletId, status: 'forming' })).resolves.toBeDefined();
  });

  it('rejects a ride request joining two pools (pool_members.ride_request_id UNIQUE)', async () => {
    const jashimId = await insertUser({ name: 'Jashim', phone: '+8801700000001', role: 'driver' });
    const nusratId = await insertUser({ name: 'Nusrat', phone: '+8801700000002', role: 'passenger' });
    const bulletId = await insertTesla({ driverId: jashimId, label: 'Bullet', capacity: 3 });
    const corridorId = await insertCorridor('Banani-Gulshan-Mohakhali');
    const banani = await insertZone({ name: 'Banani', corridorId });
    const mohakhali = await insertZone({ name: 'Mohakhali', corridorId });

    const rideRequestId = await insertRideRequest({
      passengerId: nusratId,
      pickupZoneId: banani,
      destinationZoneId: mohakhali,
    });
    const poolAId = await insertPool({ teslaId: bulletId, status: 'forming' });
    const poolBId = await insertPool({ teslaId: bulletId, status: 'completed' });

    await testPool.query(
      `INSERT INTO pool_members (pool_id, ride_request_id, seats) VALUES ($1, $2, 1)`,
      [poolAId, rideRequestId]
    );

    await expect(
      testPool.query(
        `INSERT INTO pool_members (pool_id, ride_request_id, seats) VALUES ($1, $2, 1)`,
        [poolBId, rideRequestId]
      )
    ).rejects.toThrow(/pool_members_ride_request_id_key/);
  });

  it('rejects a ride request referencing a non-existent zone', async () => {
    const nusratId = await insertUser({ name: 'Nusrat', phone: '+8801700000002', role: 'passenger' });
    const fakeZoneId = '00000000-0000-0000-0000-000000000000';

    await expect(
      insertRideRequest({
        passengerId: nusratId,
        pickupZoneId: fakeZoneId,
        destinationZoneId: fakeZoneId,
      })
    ).rejects.toThrow(/violates foreign key constraint/);
  });
});
