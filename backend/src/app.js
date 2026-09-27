const express = require('express');
const cors = require('cors');
const passengerRoutes = require('./routes/passenger.routes');
const driverRoutes = require('./routes/driver.routes');
const authRoutes = require('./routes/auth.routes');
const rideRequestRoutes = require('./routes/rideRequest.routes');
const poolRoutes = require('./routes/pool.routes');

function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/api/passengers', passengerRoutes);
  app.use('/api/drivers', driverRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/ride-requests', rideRequestRoutes);
  app.use('/api/pools', poolRoutes);

  // Centralized error handler (PDF §14: business errors flow up from the
  // service layer as typed HttpErrors instead of being handled ad hoc per route).
  app.use((err, req, res, next) => {
    const status = err.status || 500;
    if (status === 500) {
      console.error(err);
    }
    res.status(status).json({ error: err.message || 'Internal server error' });
  });

  return app;
}

module.exports = { createApp };
