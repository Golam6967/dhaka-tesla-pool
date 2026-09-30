// PDF §14: business errors flow up from the service layer as typed
// HttpErrors (errors.js) instead of being handled ad hoc per route.
function errorHandler(err, req, res, next) {
  const status = err.status || 500;

  if (status === 500) {
    // Only our own typed HttpErrors carry a deliberately client-safe
    // message. Anything else reaching here is unexpected (a bug, a raw
    // driver/DB error, etc.) — log the full error server-side but return a
    // generic message so internals (query text, constraint names, stack
    // traces) never reach the client.
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }

  res.status(status).json({ error: err.message });
}

module.exports = { errorHandler };
