const { Router } = require('express');
const driverController = require('../controllers/driver.controller');
const { requireAuth } = require('../middleware/requireAuth');
const { requireRole } = require('../middleware/requireRole');

const router = Router();

router.post('/signup', driverController.signup);
router.patch('/me/status', requireAuth, requireRole('driver'), driverController.setStatus);

module.exports = router;
