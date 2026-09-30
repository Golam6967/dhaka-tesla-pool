const { Router } = require('express');
const authController = require('../controllers/auth.controller');
const { loginLimiter } = require('../middleware/rateLimit');

const router = Router();

router.post('/login', loginLimiter, authController.login);

module.exports = router;
