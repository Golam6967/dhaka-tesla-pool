exports.up = (pgm) => {
  pgm.sql(`
    -- Fare calculation (fare.service.js) computes distance via haversine on
    -- these coordinates. A NULL here previously coerced to 0 (Number(null)),
    -- silently computing distance from the equator/prime-meridian instead of
    -- failing loudly — this constraint makes that impossible.
    ALTER TABLE zones ALTER COLUMN lat SET NOT NULL;
    ALTER TABLE zones ALTER COLUMN lng SET NOT NULL;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE zones ALTER COLUMN lat DROP NOT NULL;
    ALTER TABLE zones ALTER COLUMN lng DROP NOT NULL;
  `);
};
