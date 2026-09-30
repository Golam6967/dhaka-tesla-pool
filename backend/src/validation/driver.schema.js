const { z } = require('zod');
const { phoneSchema } = require('./common.schema');

const driverSignupSchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(120),
  phone: phoneSchema,
  password: z.string().min(6, 'password must be at least 6 characters').max(72),
  teslaLabel: z.string().trim().min(1, 'teslaLabel is required').max(60),
  teslaCapacity: z
    .number()
    .int()
    .positive('teslaCapacity must be a positive integer')
    .max(8, 'teslaCapacity cannot exceed 8'),
});

const statusSchema = z.object({
  status: z.enum(['online', 'offline']),
});

module.exports = { driverSignupSchema, statusSchema };
