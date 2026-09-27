const poolService = require('../services/pool.service');
const { acceptRideRequestSchema } = require('../validation/pool.schema');
const { validateBody } = require('../validation/validate');

function accept(req, res, next) {
  Promise.resolve()
    .then(() => {
      const { rideRequestId } = validateBody(acceptRideRequestSchema, req.body);
      return poolService.joinPool({ rideRequestId, driverId: req.user.id });
    })
    .then((result) => res.status(200).json(result))
    .catch(next);
}

module.exports = { accept };
