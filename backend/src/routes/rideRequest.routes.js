const { Router } = require('express');
const rideRequestController = require('../controllers/rideRequest.controller');
const { requireAuth } = require('../middleware/requireAuth');
const { requireRole } = require('../middleware/requireRole');

const router = Router();

router.post('/', requireAuth, requireRole('passenger'), rideRequestController.create);
router.get('/', requireAuth, requireRole('passenger'), rideRequestController.listMine);
router.get('/:id', requireAuth, rideRequestController.getById);
router.post('/:id/arrive', requireAuth, requireRole('driver'), rideRequestController.arrive);
router.post('/:id/start', requireAuth, requireRole('driver'), rideRequestController.start);
router.post('/:id/complete', requireAuth, requireRole('driver'), rideRequestController.complete);

module.exports = router;
