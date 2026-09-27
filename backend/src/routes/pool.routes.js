const { Router } = require('express');
const poolController = require('../controllers/pool.controller');
const { requireAuth } = require('../middleware/requireAuth');
const { requireRole } = require('../middleware/requireRole');

const router = Router();

router.post('/accept', requireAuth, requireRole('driver'), poolController.accept);

module.exports = router;
