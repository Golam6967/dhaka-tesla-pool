const { Router } = require('express');
const authController = require('../controllers/auth.controller');

const router = Router();

router.post('/signup', authController.passengerSignup);

module.exports = router;
