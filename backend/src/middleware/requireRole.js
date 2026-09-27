const { ForbiddenError } = require('../errors');

function requireRole(role) {
  return function (req, res, next) {
    if (!req.user || req.user.role !== role) {
      return next(new ForbiddenError(`This action requires the ${role} role`));
    }
    next();
  };
}

module.exports = { requireRole };
