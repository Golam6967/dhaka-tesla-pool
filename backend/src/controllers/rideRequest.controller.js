const rideService = require('../services/ride.service');
const { createRideRequestSchema, rideRequestIdParamsSchema } = require('../validation/rideRequest.schema');
const { validateBody, validateParams } = require('../validation/validate');

function create(req, res, next) {
  Promise.resolve()
    .then(() => {
      const data = validateBody(createRideRequestSchema, req.body);
      return rideService.createRideRequest({ ...data, passengerId: req.user.id });
    })
    .then((result) => res.status(201).json(result))
    .catch(next);
}

function getById(req, res, next) {
  Promise.resolve()
    .then(() => {
      const { id } = validateParams(rideRequestIdParamsSchema, req.params);
      return rideService.getRideRequestForUser(id, req.user);
    })
    .then((result) => res.status(200).json(result))
    .catch(next);
}

function listMine(req, res, next) {
  rideService
    .listMyRideRequests(req.user.id)
    .then((rideRequests) => res.status(200).json({ rideRequests }))
    .catch(next);
}

module.exports = { create, getById, listMine };
