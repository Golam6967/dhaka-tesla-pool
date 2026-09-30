const { z } = require('zod');
const { phoneSchema } = require('./common.schema');

const signupSchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(120),
  phone: phoneSchema,
  password: z.string().min(6, 'password must be at least 6 characters').max(72),
});

const loginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1, 'password is required').max(72),
});

module.exports = { signupSchema, loginSchema };
