exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE pools (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tesla_id uuid NOT NULL REFERENCES teslas(id),
      seats_occupied int NOT NULL DEFAULT 0,
      status pool_status NOT NULL DEFAULT 'forming',
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT seats_within_capacity CHECK (seats_occupied >= 0)
    );

    CREATE INDEX pools_tesla_id_idx ON pools (tesla_id);

    -- Architecture §4b / PDF §8: the check-then-act sequence for pool creation has
    -- the same race window as the seat-claim problem, so a prior existence-check
    -- query alone cannot prevent two concurrent pool creations for the same Tesla.
    -- This partial unique index is the actual protection: a losing concurrent
    -- INSERT hits this constraint and the application catches it and retries
    -- against the pool the winner just created.
    CREATE UNIQUE INDEX one_active_pool_per_tesla
      ON pools (tesla_id)
      WHERE status IN ('forming', 'active');
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE pools;
  `);
};
