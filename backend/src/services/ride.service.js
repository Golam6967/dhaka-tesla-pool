const { pool } = require('../db/pool');
const zoneRepository = require('../repositories/zone.repository');
const rideRequestRepository = require('../repositories/rideRequest.repository');
const fareRepository = require('../repositories/fare.repository');
const rideStatusHistoryRepository = require('../repositories/rideStatusHistory.repository');
const fareService = require('../services/fare.service');
const { ValidationError, NotFoundError, ForbiddenError } = require('../errors');

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

module.exports = { createRideRequest, getRideRequestForUser, listMyRideRequests };
