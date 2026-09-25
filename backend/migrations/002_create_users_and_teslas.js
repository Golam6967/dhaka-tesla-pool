exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name varchar(120) NOT NULL,
      phone varchar(20) NOT NULL UNIQUE,
      password_hash varchar(255) NOT NULL,
      role user_role NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE teslas (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      driver_id uuid NOT NULL REFERENCES users(id),
      label varchar(60) NOT NULL,
      capacity int NOT NULL,
      status tesla_status NOT NULL DEFAULT 'offline',
      CONSTRAINT positive_capacity CHECK (capacity > 0)
    );

    CREATE INDEX teslas_driver_id_idx ON teslas (driver_id);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE teslas;
    DROP TABLE users;
  `);
};
