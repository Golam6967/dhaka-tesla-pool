const { ValidationError } = require('../errors');

function validateBody(schema, body) {
  const result = schema.safeParse(body);
  if (!result.success) {
    const message = result.error.issues.map((issue) => issue.message).join(', ');
    throw new ValidationError(message);
  }
  return result.data;
}

module.exports = { validateBody };
