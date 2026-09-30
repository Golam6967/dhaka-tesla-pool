const bcrypt = require('bcryptjs');
const { pool: dbPool } = require('../db/pool');
const userRepository = require('../repositories/user.repository');
const teslaRepository = require('../repositories/tesla.repository');
const poolRepository = require('../repositories/pool.repository');
const poolMemberRepository = require('../repositories/poolMember.repository');
const rideRequestRepository = require('../repositories/rideRequest.repository');
const zoneRepository = require('../repositories/zone.repository');
const fareRepository = require('../repositories/fare.repository');
const { signToken } = require('../config/jwt');
const { ConflictError, NotFoundError } = require('../errors');
const { isUniqueViolation } = require('../db/pgErrors');

const SALT_ROUNDS = 10;

async function signup({ name, phone, password, teslaLabel, teslaCapacity }) {
  const existing = await userRepository.findByPhone(phone);
  if (existing) {
    throw new ConflictError('An account with this phone number already exists');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');
    const user = await userRepository.createWithClient(client, {
      name,
      phone,
      passwordHash,
      role: 'driver',
    });
    const tesla = await teslaRepository.createWithClient(client, {
      driverId: user.id,
      label: teslaLabel,
      capacity: teslaCapacity,
    });
    await client.query('COMMIT');

    return {
      token: signToken(user),
      user: userRepository.toPublicUser(user),
      tesla: teslaRepository.toPublicTesla(tesla),
    };
  } catch (err) {
    await client.query('ROLLBACK');
    // Same race as auth.service.js's signup: the pre-check above can't see
    // a concurrent signup with the same phone. Convert the database's own
    // constraint violation into the same clean 409 instead of a raw
    // Postgres error reaching the client.
    if (isUniqueViolation(err, 'users_phone_key')) {
      throw new ConflictError('An account with this phone number already exists');
    }
    throw err;
  } finally {
    client.release();
  }
}

async function setStatus(driverId, status) {
  const tesla = await teslaRepository.findByDriverId(driverId);
  if (!tesla) {
    throw new NotFoundError('No Tesla is registered for this driver');
  }

  const updated = await teslaRepository.updateStatus(tesla.id, status);
  return teslaRepository.toPublicTesla(updated);
}

// "Relevant requests" for a driver: pending ride requests that would fit
// their Tesla's remaining capacity and, once they already have a
// forming/active pool, are compatible with that pool's pickup-zone/
// destination-corridor profile (architecture.md §4/§6 matching rule).
async function listAvailableRequests(driverId) {
  const tesla = await teslaRepository.findByDriverId(driverId);
  if (!tesla) {
    throw new NotFoundError('No Tesla is registered for this driver');
  }

  const existingPool = await poolRepository.findActiveOrFormingByTeslaId(tesla.id);
  const remainingCapacity = existingPool ? tesla.capacity - existingPool.seats_occupied : tesla.capacity;

  let poolProfile = null;
  if (existingPool) {
    const members = await poolMemberRepository.findMembersWithRideDetails(dbPool, existingPool.id);
    if (members.length > 0) {
      const destinationZone = await zoneRepository.findById(members[0].destination_zone_id);
      poolProfile = {
        pickupZoneId: members[0].pickup_zone_id,
        destinationCorridorId: destinationZone.corridor_id,
      };
    }
  }

  const pendingRequests = await rideRequestRepository.findPending();

  const compatible = [];
  for (const rideRequest of pendingRequests) {
    if (rideRequest.seats_requested > remainingCapacity) {
      continue;
    }
    if (poolProfile) {
      const destinationZone = await zoneRepository.findById(rideRequest.destination_zone_id);
      const samePickup = rideRequest.pickup_zone_id === poolProfile.pickupZoneId;
      const sameCorridor = destinationZone.corridor_id === poolProfile.destinationCorridorId;
      if (!samePickup || !sameCorridor) {
        continue;
      }
    }
    compatible.push(rideRequestRepository.toPublic(rideRequest));
  }

  return compatible;
}

async function loadPoolWithMembers(poolRow) {
  const memberRows = await poolMemberRepository.findMembersWithRideDetails(dbPool, poolRow.id);
  const members = await Promise.all(
    memberRows.map(async (member) => {
      const rideRequest = await rideRequestRepository.findById(member.ride_request_id);
      const fare = await fareRepository.findByRideRequestId(member.ride_request_id);
      return {
        rideRequest: rideRequestRepository.toPublic(rideRequest),
        fare: fare ? fareRepository.toPublic(fare) : null,
      };
    })
  );
  return { pool: poolRepository.toPublic(poolRow), members };
}

// So the driver UI can show who's in their pool and offer arrive/start/
// complete actions per passenger (PDF §3: "see passengers/seats").
async function getActivePool(driverId) {
  const tesla = await teslaRepository.findByDriverId(driverId);
  if (!tesla) {
    throw new NotFoundError('No Tesla is registered for this driver');
  }

  const poolRow = await poolRepository.findActiveOrFormingByTeslaId(tesla.id);
  if (!poolRow) {
    return { tesla: teslaRepository.toPublicTesla(tesla), pool: null, members: [] };
  }

  const { pool: publicPool, members } = await loadPoolWithMembers(poolRow);
  return { tesla: teslaRepository.toPublicTesla(tesla), pool: publicPool, members };
}

// PDF §3: driver should be able to see ride history, not just the current pool.
async function getHistory(driverId) {
  const tesla = await teslaRepository.findByDriverId(driverId);
  if (!tesla) {
    throw new NotFoundError('No Tesla is registered for this driver');
  }

  const pastPools = await poolRepository.findPastByTeslaId(tesla.id);
  const pools = await Promise.all(pastPools.map(loadPoolWithMembers));
  return { pools };
}

module.exports = { signup, setStatus, listAvailableRequests, getActivePool, getHistory };
