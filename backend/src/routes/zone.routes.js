const { Router } = require('express');
const zoneController = require('../controllers/zone.controller');

const router = Router();

// Public: zones/corridors are static reference data (architecture.md §2),
// not sensitive, and needed to populate pickup/destination pickers before
// a user is authenticated.
router.get('/', zoneController.list);

module.exports = router;
