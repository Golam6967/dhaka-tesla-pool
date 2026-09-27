const { pool: dbPool } = require('../db/pool');
const rideRequestRepository = require('../repositories/rideRequest.repository');
const teslaRepository = require('../repositories/tesla.repository');
const poolRepository = require('../repositories/pool.repository');
const poolMemberRepository = require('../repositories/poolMember.repository');
const poolStatusHistoryRepository = require('../repositories/poolStatusHistory.repository');
const rideStatusHistoryRepository = require('../repositories/rideStatusHistory.repository');
const fareRepository = require('../repositories/fare.repository');
const zoneRepository = require('../repositories/zone.repository');
const fareService = require('../services/fare.service');
const { assertValidTransition } = require('./rideStateMachine');
const { NotFoundError, ValidationError, ConflictError } = require('../errors');

const ONE_ACTIVE_POOL_CONSTRAINT = 'one_active_pool_per_tesla';
const MAX_POOL_CREATE_RETRIES = 3;

function isUniqueViolation(err, constraintName) {
  return err && err.code === '23505' && err.constraint === constraintName;
}

async function performJoin(client, { rideRequestId, driverId }) {
  // Row lock so this ride request cannot be matched by two concurrent
  // "accept" calls (from two different drivers) at once.
  const rideRequest = await rideRequestRepository.findByIdForUpdate(client, rideRequestId);
  if (!rideRequest) {
    throw new NotFoundError('Ride request not found');
  }
  assertValidTransition(rideRequest.status, 'matched');

  const tesla = await teslaRepository.findByDriverIdWithClient(client, driverId);
  if (!tesla) {
    throw new NotFoundError('No Tesla is registered for this driver');
  }
  if (tesla.status !== 'online') {
    throw new ValidationError('Tesla must be online to accept ride requests');
  }

  // architecture.md §4a: this lock (or the fresh row created just below)
  // serializes every concurrent seat claim against this Tesla's pool.
  let poolRow = await poolRepository.findLockedActiveOrFormingByTeslaId(client, tesla.id);
  if (!poolRow) {
    // May throw a unique_violation (architecture.md §4b) if another
    // transaction committed a pool for this Tesla first — left to bubble up
    // to joinPool's retry wrapper.
    poolRow = await poolRepository.createForming(client, tesla.id);
  }

  const existingMembers = await poolMemberRepository.findMembersWithRideDetails(client, poolRow.id);

  if (existingMembers.length > 0) {
    const firstMember = existingMembers[0];
    const [newDestinationZone, existingDestinationZone] = await Promise.all([
      zoneRepository.findById(rideRequest.destination_zone_id),
      zoneRepository.findById(firstMember.destination_zone_id),
    ]);

    const samePickup = firstMember.pickup_zone_id === rideRequest.pickup_zone_id;
    const sameDestinationCorridor = newDestinationZone.corridor_id === existingDestinationZone.corridor_id;

    if (!samePickup || !sameDestinationCorridor) {
      throw new ValidationError(
        "This ride request isn't compatible with the existing pool (must share pickup zone and destination corridor)"
      );
    }
  }

  const newSeatsOccupied = poolRow.seats_occupied + rideRequest.seats_requested;
  if (newSeatsOccupied > tesla.capacity) {
    throw new ConflictError('Not enough seats remaining on this Tesla for this ride request');
  }

  await poolRepository.updateSeatsOccupied(client, poolRow.id, newSeatsOccupied);
  await poolMemberRepository.create(client, {
    poolId: poolRow.id,
    rideRequestId: rideRequest.id,
    seats: rideRequest.seats_requested,
  });
  await poolStatusHistoryRepository.insert(client, {
    poolId: poolRow.id,
    seatsOccupiedBefore: poolRow.seats_occupied,
    seatsOccupiedAfter: newSeatsOccupied,
    event: 'member_joined',
  });

  await rideRequestRepository.markMatchedWithClient(client, rideRequest.id, poolRow.id);
  await rideStatusHistoryRepository.insertWithClient(client, {
    rideRequestId: rideRequest.id,
    fromStatus: rideRequest.status,
    toStatus: 'matched',
  });

  const allMembers = [
    ...existingMembers.map((m) => ({
      rideRequestId: m.ride_request_id,
      pickupZoneId: m.pickup_zone_id,
      destinationZoneId: m.destination_zone_id,
    })),
    {
      rideRequestId: rideRequest.id,
      pickupZoneId: rideRequest.pickup_zone_id,
      destinationZoneId: rideRequest.destination_zone_id,
    },
  ];

  let currentFare = await fareRepository.findByRideRequestIdWithClient(client, rideRequest.id);

  // architecture.md §3 "Retroactive discount on join": once the pool has 2+
  // members, every member's fare (including ones created earlier as
  // no-discount solo estimates) is recomputed together, in this transaction.
  if (allMembers.length >= 2) {
    for (const member of allMembers) {
      const [pickupZone, destinationZone] = await Promise.all([
        zoneRepository.findById(member.pickupZoneId),
        zoneRepository.findById(member.destinationZoneId),
      ]);
      const fare = fareService.calculateFare({ pickupZone, destinationZone, isPooled: true });
      const updated = await fareRepository.updateDiscountWithClient(client, member.rideRequestId, {
        poolDiscountPaisa: fare.poolDiscountPaisa,
        totalFarePaisa: fare.totalFarePaisa,
      });
      if (member.rideRequestId === rideRequest.id) {
        currentFare = updated;
      }
    }
  }

  return {
    pool: poolRepository.toPublic({ ...poolRow, seats_occupied: newSeatsOccupied }),
    rideRequest: rideRequestRepository.toPublic({ ...rideRequest, status: 'matched', pool_id: poolRow.id }),
    fare: fareRepository.toPublic(currentFare),
  };
}

async function attemptJoinOnce(params) {
  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');
    const result = await performJoin(client, params);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function joinPool(params, retriesLeft = MAX_POOL_CREATE_RETRIES) {
  try {
    return await attemptJoinOnce(params);
  } catch (err) {
    if (isUniqueViolation(err, ONE_ACTIVE_POOL_CONSTRAINT) && retriesLeft > 0) {
      return joinPool(params, retriesLeft - 1);
    }
    throw err;
  }
}

module.exports = { joinPool };
