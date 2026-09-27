const zoneRepository = require('../repositories/zone.repository');

function list(req, res, next) {
  zoneRepository
    .findAll()
    .then((zones) => res.status(200).json({ zones: zones.map(zoneRepository.toPublic) }))
    .catch(next);
}

module.exports = { list };
