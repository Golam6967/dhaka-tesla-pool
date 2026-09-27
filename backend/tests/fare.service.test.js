const { calculateFare, distanceKmBetweenZones } = require('../src/services/fare.service');

// Matches the seeded coordinates in scripts/seed.js — calibrated so these
// distances round to the exact whole-km figures the fare model requires.
const banani = { lat: 23.7936, lng: 90.4043 };
const mohakhali = { lat: 23.7936, lng: 90.44357 };
const gulshan1 = { lat: 23.7936, lng: 90.43375 };

describe('fare.service', () => {
  it('computes the Banani -> Mohakhali distance as 4km', () => {
    expect(distanceKmBetweenZones(banani, mohakhali)).toBe(4);
  });

  it('computes the Banani -> Gulshan 1 distance as 3km', () => {
    expect(distanceKmBetweenZones(banani, gulshan1)).toBe(3);
  });

  it("matches architecture.md's worked example: Nusrat's pooled fare is exactly 7200 paisa", () => {
    const fare = calculateFare({
      pickupZone: banani,
      destinationZone: mohakhali,
      isPooled: true,
    });

    expect(fare.distanceKm).toBe(4);
    expect(fare.baseFarePaisa).toBe(3000);
    expect(fare.distanceChargePaisa).toBe(6000);
    expect(fare.poolDiscountPaisa).toBe(1800);
    expect(fare.totalFarePaisa).toBe(7200);
  });

  it("matches architecture.md's worked example: Rafiq's pooled fare is exactly 6000 paisa", () => {
    const fare = calculateFare({
      pickupZone: banani,
      destinationZone: gulshan1,
      isPooled: true,
    });

    expect(fare.distanceKm).toBe(3);
    expect(fare.baseFarePaisa).toBe(3000);
    expect(fare.distanceChargePaisa).toBe(4500);
    expect(fare.poolDiscountPaisa).toBe(1500);
    expect(fare.totalFarePaisa).toBe(6000);
  });

  it('applies no discount for an unpooled (solo) ride', () => {
    const fare = calculateFare({
      pickupZone: banani,
      destinationZone: mohakhali,
      isPooled: false,
    });

    expect(fare.poolDiscountPaisa).toBe(0);
    expect(fare.totalFarePaisa).toBe(9000);
  });
});
