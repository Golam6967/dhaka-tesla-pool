exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE ride_requests (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      passenger_id uuid NOT NULL REFERENCES users(id),
      pickup_zone_id uuid NOT NULL REFERENCES zones(id),
      destination_zone_id uuid NOT NULL REFERENCES zones(id),
      seats_requested int NOT NULL,
      status ride_status NOT NULL DEFAULT 'requested',
      pool_id uuid REFERENCES pools(id),
      requested_at timestamptz NOT NULL DEFAULT now(),
      matched_at timestamptz,
      arrived_at timestamptz,
      started_at timestamptz,
      completed_at timestamptz,
      cancelled_at timestamptz,
      CONSTRAINT positive_seats_requested CHECK (seats_requested > 0)
    );

    CREATE INDEX ride_requests_passenger_id_idx ON ride_requests (passenger_id);
    CREATE INDEX ride_requests_pool_id_idx ON ride_requests (pool_id);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE ride_requests;
  `);
};
