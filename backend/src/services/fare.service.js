const BASE_FARE_PAISA = 3000;
const PER_KM_RATE_PAISA = 1500;
const POOL_DISCOUNT_RATE = 0.2;

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

// Straight-line (haversine) distance between two zones, rounded to the
// nearest whole km. This is arithmetic over already-stored zone coordinates,
// not live routing (architecture.md §3/§8) — zone lat/lng are illustrative
// and calibrated for the demo, not surveyed real-world positions.
function distanceKmBetweenZones(pickupZone, destinationZone) {
  const lat1 = toRadians(Number(pickupZone.lat));
  const lat2 = toRadians(Number(destinationZone.lat));
  const dLat = lat2 - lat1;
  const dLng = toRadians(Number(destinationZone.lng) - Number(pickupZone.lng));

  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const distanceKm = 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));

  return Math.round(distanceKm);
}

// The pool discount is only known once a ride is actually placed into a
// pool with another passenger (architecture.md §3), so ride-request creation
// only ever produces the no-discount estimate. isPooled=true is used later
// by the pool service to compute the final, discounted fare on the same row.
function calculateFare({ pickupZone, destinationZone, isPooled = false }) {
  const distanceKm = distanceKmBetweenZones(pickupZone, destinationZone);
  const distanceChargePaisa = distanceKm * PER_KM_RATE_PAISA;
  const subtotalPaisa = BASE_FARE_PAISA + distanceChargePaisa;
  const poolDiscountPaisa = isPooled ? Math.round(subtotalPaisa * POOL_DISCOUNT_RATE) : 0;
  const totalFarePaisa = subtotalPaisa - poolDiscountPaisa;

  return {
    distanceKm,
    baseFarePaisa: BASE_FARE_PAISA,
    distanceChargePaisa,
    poolDiscountPaisa,
    totalFarePaisa,
  };
}

module.exports = {
  BASE_FARE_PAISA,
  PER_KM_RATE_PAISA,
  POOL_DISCOUNT_RATE,
  distanceKmBetweenZones,
  calculateFare,
};
