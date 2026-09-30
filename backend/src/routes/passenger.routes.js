const { Router } = require('express');
const authController = require('../controllers/auth.controller');
const { signupLimiter } = require('../middleware/rateLimit');

const router = Router();

router.post('/signup', signupLimiter, authController.passengerSignup);

module.exports = router;
