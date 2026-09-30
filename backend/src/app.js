const express = require('express');
const cors = require('cors');
const passengerRoutes = require('./routes/passenger.routes');
const driverRoutes = require('./routes/driver.routes');
const authRoutes = require('./routes/auth.routes');
const rideRequestRoutes = require('./routes/rideRequest.routes');
const poolRoutes = require('./routes/pool.routes');
const zoneRoutes = require('./routes/zone.routes');
const { errorHandler } = require('./middleware/errorHandler');

function createApp() {
  const app = express();

  // CORS_ORIGIN restricts which frontend origin may call this API. Left
  // unset, it falls back to '*' (fine for local dev, not for a real
  // deployment) — set it to the deployed frontend's exact origin in
  // production so a script on an unrelated site can't ride a logged-in
  // browser's session.
  const corsOrigin = process.env.CORS_ORIGIN || '*';
  app.use(cors({ origin: corsOrigin }));
  app.use(express.json());

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/api/passengers', passengerRoutes);
  app.use('/api/drivers', driverRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/ride-requests', rideRequestRoutes);
  app.use('/api/pools', poolRoutes);
  app.use('/api/zones', zoneRoutes);

  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
