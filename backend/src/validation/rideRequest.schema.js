const { z } = require('zod');

const createRideRequestSchema = z.object({
  pickupZoneId: z.string().uuid('pickupZoneId must be a valid UUID'),
  destinationZoneId: z.string().uuid('destinationZoneId must be a valid UUID'),
  seatsRequested: z.number().int().positive('seatsRequested must be a positive integer'),
});

const rideRequestIdParamsSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
});

module.exports = { createRideRequestSchema, rideRequestIdParamsSchema };
