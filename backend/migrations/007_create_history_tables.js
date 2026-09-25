exports.up = (pgm) => {
  pgm.sql(`
    -- Append-only: rows are inserted by the ride/pool services and never
    -- updated or deleted. See architecture.md §2 for why this is kept
    -- separate from deriving status off the other table.
    CREATE TABLE ride_status_history (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      ride_request_id uuid NOT NULL REFERENCES ride_requests(id),
      from_status ride_status,
      to_status ride_status NOT NULL,
      changed_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX ride_status_history_ride_request_id_idx
      ON ride_status_history (ride_request_id);

    CREATE TABLE pool_status_history (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      pool_id uuid NOT NULL REFERENCES pools(id),
      seats_occupied_before int NOT NULL,
      seats_occupied_after int NOT NULL,
      event pool_history_event NOT NULL,
      changed_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX pool_status_history_pool_id_idx ON pool_status_history (pool_id);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE pool_status_history;
    DROP TABLE ride_status_history;
  `);
};
