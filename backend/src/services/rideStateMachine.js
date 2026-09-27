const { ValidationError } = require('../errors');

// The single authoritative transition table for ride_requests.status
// (PDF §10). Every status-changing operation in the codebase must go
// through assertValidTransition instead of writing status directly.
const ALLOWED_TRANSITIONS = {
  requested: ['matched', 'cancelled'],
  matched: ['driver_arrived', 'cancelled'],
  driver_arrived: ['started'],
  started: ['completed'],
  completed: [],
  cancelled: [],
};

function assertValidTransition(fromStatus, toStatus) {
  const allowed = ALLOWED_TRANSITIONS[fromStatus] || [];
  if (!allowed.includes(toStatus)) {
    throw new ValidationError(`Cannot transition ride from ${fromStatus} to ${toStatus}`);
  }
}

module.exports = { ALLOWED_TRANSITIONS, assertValidTransition };
