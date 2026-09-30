// Postgres error code 23505 = unique_violation. `constraintName` narrows to a
// specific constraint (e.g. 'users_phone_key') when the caller needs to
// distinguish which uniqueness rule was hit; omit it to match any.
function isUniqueViolation(err, constraintName) {
  return Boolean(err) && err.code === '23505' && (!constraintName || err.constraint === constraintName);
}

module.exports = { isUniqueViolation };
