exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE corridors (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name varchar(120) NOT NULL UNIQUE
    );

    CREATE TABLE zones (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name varchar(120) NOT NULL UNIQUE,
      corridor_id uuid NOT NULL REFERENCES corridors(id),
      lat numeric(9, 6),
      lng numeric(9, 6)
    );

    CREATE INDEX zones_corridor_id_idx ON zones (corridor_id);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE zones;
    DROP TABLE corridors;
  `);
};
