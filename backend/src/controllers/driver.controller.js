const driverService = require('../services/driver.service');
const { driverSignupSchema, statusSchema } = require('../validation/driver.schema');
const { validateBody } = require('../validation/validate');

function signup(req, res, next) {
  Promise.resolve()
    .then(() => {
      const data = validateBody(driverSignupSchema, req.body);
      return driverService.signup(data);
    })
    .then((result) => res.status(201).json(result))
    .catch(next);
}

function setStatus(req, res, next) {
  Promise.resolve()
    .then(() => {
      const { status } = validateBody(statusSchema, req.body);
      return driverService.setStatus(req.user.id, status);
    })
    .then((tesla) => res.status(200).json({ tesla }))
    .catch(next);
}

module.exports = { signup, setStatus };
