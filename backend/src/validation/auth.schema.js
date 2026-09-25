const { z } = require('zod');

const signupSchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(120),
  phone: z.string().trim().min(6, 'phone is required').max(20),
  password: z.string().min(6, 'password must be at least 6 characters').max(72),
});

const loginSchema = z.object({
  phone: z.string().trim().min(1, 'phone is required'),
  password: z.string().min(1, 'password is required'),
});

module.exports = { signupSchema, loginSchema };
