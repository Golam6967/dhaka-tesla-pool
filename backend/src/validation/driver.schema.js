const { z } = require('zod');

const driverSignupSchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(120),
  phone: z.string().trim().min(6, 'phone is required').max(20),
  password: z.string().min(6, 'password must be at least 6 characters').max(72),
  teslaLabel: z.string().trim().min(1, 'teslaLabel is required').max(60),
  teslaCapacity: z.number().int().positive('teslaCapacity must be a positive integer'),
});

const statusSchema = z.object({
  status: z.enum(['online', 'offline']),
});

module.exports = { driverSignupSchema, statusSchema };
