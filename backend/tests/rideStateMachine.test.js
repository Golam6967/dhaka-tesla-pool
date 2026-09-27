const { assertValidTransition } = require('../src/services/rideStateMachine');

describe('rideStateMachine', () => {
  it.each([
    ['requested', 'matched'],
    ['requested', 'cancelled'],
    ['matched', 'driver_arrived'],
    ['matched', 'cancelled'],
    ['driver_arrived', 'started'],
    ['started', 'completed'],
  ])('allows %s -> %s', (from, to) => {
    expect(() => assertValidTransition(from, to)).not.toThrow();
  });

  it.each([
    ['started', 'requested'],
    ['completed', 'requested'],
    ['cancelled', 'started'],
    ['completed', 'cancelled'],
    ['driver_arrived', 'cancelled'],
    ['requested', 'started'],
    ['requested', 'completed'],
  ])('rejects %s -> %s', (from, to) => {
    expect(() => assertValidTransition(from, to)).toThrow();
  });
});
