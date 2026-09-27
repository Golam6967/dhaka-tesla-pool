const { Router } = require('express');
const driverController = require('../controllers/driver.controller');
const { requireAuth } = require('../middleware/requireAuth');
const { requireRole } = require('../middleware/requireRole');

const router = Router();

router.post('/signup', driverController.signup);
router.patch('/me/status', requireAuth, requireRole('driver'), driverController.setStatus);
router.get(
  '/me/available-requests',
  requireAuth,
  requireRole('driver'),
  driverController.listAvailableRequests
);
router.get('/me/active-pool', requireAuth, requireRole('driver'), driverController.getActivePool);

module.exports = router;
