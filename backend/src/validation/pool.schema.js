const { z } = require('zod');

const acceptRideRequestSchema = z.object({
  rideRequestId: z.string().uuid('rideRequestId must be a valid UUID'),
});

module.exports = { acceptRideRequestSchema };
