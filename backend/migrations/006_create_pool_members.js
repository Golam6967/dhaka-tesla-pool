exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE pool_members (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      pool_id uuid NOT NULL REFERENCES pools(id),
      ride_request_id uuid NOT NULL UNIQUE REFERENCES ride_requests(id),
      seats int NOT NULL,
      joined_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT positive_seats CHECK (seats > 0)
    );

    CREATE INDEX pool_members_pool_id_idx ON pool_members (pool_id);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE pool_members;
  `);
};
