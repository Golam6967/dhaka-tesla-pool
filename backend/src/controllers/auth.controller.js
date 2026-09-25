const authService = require('../services/auth.service');
const { signupSchema, loginSchema } = require('../validation/auth.schema');
const { validateBody } = require('../validation/validate');

function passengerSignup(req, res, next) {
  Promise.resolve()
    .then(() => {
      const data = validateBody(signupSchema, req.body);
      // role is fixed by the route, never taken from the request body, so a
      // passenger cannot self-register as a driver.
      return authService.signup({ ...data, role: 'passenger' });
    })
    .then((result) => res.status(201).json(result))
    .catch(next);
}

function login(req, res, next) {
  Promise.resolve()
    .then(() => {
      const data = validateBody(loginSchema, req.body);
      return authService.login(data);
    })
    .then((result) => res.status(200).json(result))
    .catch(next);
}

module.exports = { passengerSignup, login };
