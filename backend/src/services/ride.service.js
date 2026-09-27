const { pool } = require('../db/pool');
const zoneRepository = require('../repositories/zone.repository');
const rideRequestRepository = require('../repositories/rideRequest.repository');
const fareRepository = require('../repositories/fare.repository');
const rideStatusHistoryRepository = require('../repositories/rideStatusHistory.repository');
const teslaRepository = require('../repositories/tesla.repository');
const poolRepository = require('../repositories/pool.repository');
const poolMemberRepository = require('../repositories/poolMember.repository');
const poolStatusHistoryRepository = require('../repositories/poolStatusHistory.repository');
const fareService = require('../services/fare.service');
const { assertValidTransition } = require('./rideStateMachine');
const { ValidationError, NotFoundError, ForbiddenError } = require('../errors');

const TERMINAL_STATUSES = ['completed', 'cancelled'];

async function createRideRequest({ passengerId, pickupZoneId, destinationZoneId, seatsRequested }) {
  const [pickupZone, destinationZone] = await Promise.all([
    zoneRepository.findById(pickupZoneId),
    zoneRepository.findById(destinationZoneId),
  ]);

  if (!pickupZone) {
    throw new ValidationError('pickupZoneId does not reference an existing zone');
  }
  if (!destinationZone) {
    throw new ValidationError('destinationZoneId does not reference an existing zone');
  }

  const estimate = fareService.calculateFare({ pickupZone, destinationZone, isPooled: false });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const rideRequest = await rideRequestRepository.createWithClient(client, {
      passengerId,
      pickupZoneId,
      destinationZoneId,
      seatsRequested,
    });

    const fare = await fareRepository.createWithClient(client, {
      rideRequestId: rideRequest.id,
      baseFarePaisa: estimate.baseFarePaisa,
      distanceChargePaisa: estimate.distanceChargePaisa,
      poolDiscountPaisa: estimate.poolDiscountPaisa,
      totalFarePaisa: estimate.totalFarePaisa,
    });

    await rideStatusHistoryRepository.insertWithClient(client, {
      rideRequestId: rideRequest.id,
      fromStatus: null,
      toStatus: 'requested',
    });

    await client.query('COMMIT');

    return {
      rideRequest: rideRequestRepository.toPublic(rideRequest),
      fare: fareRepository.toPublic(fare),
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getRideRequestForUser(rideRequestId, requestingUser) {
  const rideRequest = await rideRequestRepository.findById(rideRequestId);
  if (!rideRequest) {
    throw new NotFoundError('Ride request not found');
  }

  // A passenger may only view their own ride (PDF §12). Driver-side ownership
  // (viewing rides on a pool they're driving) is added in feature/authorization
  // once driver-flow exists.
  if (requestingUser.role === 'passenger' && rideRequest.passenger_id !== requestingUser.id) {
    throw new ForbiddenError('You cannot view another passenger\'s ride');
  }

  const fare = await fareRepository.findByRideRequestId(rideRequestId);

  return {
    rideRequest: rideRequestRepository.toPublic(rideRequest),
    fare: fare ? fareRepository.toPublic(fare) : null,
  };
}

async function listMyRideRequests(passengerId) {
  const rideRequests = await rideRequestRepository.findByPassengerId(passengerId);
  return rideRequests.map(rideRequestRepository.toPublic);
}

async function assertDriverOwnsRide(client, rideRequest, driverId) {
  if (!rideRequest.pool_id) {
    throw new ForbiddenError('This ride request has not been matched to a pool yet');
  }
  const poolRow = await poolRepository.findByIdForUpdate(client, rideRequest.pool_id);
  const tesla = await teslaRepository.findByDriverIdWithClient(client, driverId);
  if (!tesla || poolRow.tesla_id !== tesla.id) {
    throw new ForbiddenError("You cannot operate on another driver's ride");
  }
  return poolRow;
}

async function performDriverTransition({ rideRequestId, driverId, toStatus, markFn, onAfterUpdate }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const rideRequest = await rideRequestRepository.findByIdForUpdate(client, rideRequestId);
    if (!rideRequest) {
      throw new NotFoundError('Ride request not found');
    }

    const poolRow = await assertDriverOwnsRide(client, rideRequest, driverId);
    assertValidTransition(rideRequest.status, toStatus);

    const updated = await markFn(client, rideRequestId);
    await rideStatusHistoryRepository.insertWithClient(client, {
      rideRequestId,
      fromStatus: rideRequest.status,
      toStatus,
    });

    if (onAfterUpdate) {
      await onAfterUpdate(client, poolRow);
    }

    await client.query('COMMIT');
    return rideRequestRepository.toPublic(updated);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function markDriverArrived({ rideRequestId, driverId }) {
  return performDriverTransition({
    rideRequestId,
    driverId,
    toStatus: 'driver_arrived',
    markFn: rideRequestRepository.markDriverArrivedWithClient,
  });
}

async function markStarted({ rideRequestId, driverId }) {
  return performDriverTransition({
    rideRequestId,
    driverId,
    toStatus: 'started',
    markFn: rideRequestRepository.markStartedWithClient,
    // architecture.md: pool moves forming -> active the first time any
    // member of it actually starts.
    onAfterUpdate: async (client, poolRow) => {
      if (poolRow.status === 'forming') {
        await poolRepository.updateStatus(client, poolRow.id, 'active');
        await poolStatusHistoryRepository.insert(client, {
          poolId: poolRow.id,
          seatsOccupiedBefore: poolRow.seats_occupied,
          seatsOccupiedAfter: poolRow.seats_occupied,
          event: 'status_changed',
        });
      }
    },
  });
}

async function markCompleted({ rideRequestId, driverId }) {
  return performDriverTransition({
    rideRequestId,
    driverId,
    toStatus: 'completed',
    markFn: rideRequestRepository.markCompletedWithClient,
    // architecture.md: pool moves to completed once every member has
    // reached a terminal ride status.
    onAfterUpdate: async (client, poolRow) => {
      // Reads this member's own just-written 'completed' status too, since
      // it's the same transaction/client (read-your-own-writes).
      const siblingStatuses = await poolMemberRepository.findSiblingStatuses(client, poolRow.id);
      const allTerminal = siblingStatuses.every((status) => TERMINAL_STATUSES.includes(status));
      if (allTerminal && poolRow.status !== 'completed') {
        await poolRepository.updateStatus(client, poolRow.id, 'completed');
        await poolStatusHistoryRepository.insert(client, {
          poolId: poolRow.id,
          seatsOccupiedBefore: poolRow.seats_occupied,
          seatsOccupiedAfter: poolRow.seats_occupied,
          event: 'status_changed',
        });
      }
    },
  });
}

module.exports = {
  createRideRequest,
  getRideRequestForUser,
  listMyRideRequests,
  markDriverArrived,
  markStarted,
  markCompleted,
};
