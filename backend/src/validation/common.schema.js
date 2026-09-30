const { z } = require('zod');

// Accepts an optional leading '+' followed by 7-15 digits (E.164's own
// length bound), after stripping spaces/dashes so "+880 170-0000002" and
// "+8801700000002" normalize to the exact same stored/looked-up value.
// Previously this was just `min(6).max(20)` on an unconstrained string,
// which accepted non-numeric values like "abcdef" as a "phone number".
const PHONE_REGEX = /^\+?[0-9]{7,15}$/;

const phoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s-]/g, ''))
  .pipe(z.string().regex(PHONE_REGEX, 'phone must be a valid phone number (7-15 digits, optional leading +)'));

module.exports = { phoneSchema, PHONE_REGEX };
