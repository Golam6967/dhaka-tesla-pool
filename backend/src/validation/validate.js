const { ValidationError } = require('../errors');

function validateWith(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = result.error.issues.map((issue) => issue.message).join(', ');
    throw new ValidationError(message);
  }
  return result.data;
}

function validateBody(schema, body) {
  return validateWith(schema, body);
}

function validateParams(schema, params) {
  return validateWith(schema, params);
}

module.exports = { validateBody, validateParams };
