const bcrypt = require('bcryptjs');
const { pool } = require('../db/pool');
const userRepository = require('../repositories/user.repository');
const teslaRepository = require('../repositories/tesla.repository');
const poolRepository = require('../repositories/pool.repository');
const poolMemberRepository = require('../repositories/poolMember.repository');
const rideRequestRepository = require('../repositories/rideRequest.repository');
const zoneRepository = require('../repositories/zone.repository');
const fareRepository = require('../repositories/fare.repository');
const { signToken } = require('../config/jwt');
const { ConflictError, NotFoundError } = require('../errors');

const SALT_ROUNDS = 10;

async function signup({ name, phone, password, teslaLabel, teslaCapacity }) {
  const existing = await userRepository.findByPhone(phone);
  if (existing) {
    throw new ConflictError('An account with this phone number already exists');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const client = await pool.connect();
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
    const members = await poolMemberRepository.findMembersWithRideDetails(pool, existingPool.id);
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

  const memberRows = await poolMemberRepository.findMembersWithRideDetails(pool, poolRow.id);
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

  return {
    tesla: teslaRepository.toPublicTesla(tesla),
    pool: poolRepository.toPublic(poolRow),
    members,
  };
}

module.exports = { signup, setStatus, listAvailableRequests, getActivePool };
