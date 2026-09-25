exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE fares (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      ride_request_id uuid NOT NULL UNIQUE REFERENCES ride_requests(id),
      base_fare_paisa int NOT NULL,
      distance_charge_paisa int NOT NULL,
      pool_discount_paisa int NOT NULL,
      total_fare_paisa int NOT NULL,
      payment_method payment_method NOT NULL DEFAULT 'cash',
      payment_status payment_status NOT NULL DEFAULT 'pending'
    );
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE fares;
  `);
};
