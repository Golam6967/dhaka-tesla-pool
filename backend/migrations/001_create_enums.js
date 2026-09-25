exports.up = (pgm) => {
  pgm.sql(`
    CREATE TYPE user_role AS ENUM ('passenger', 'driver');
    CREATE TYPE tesla_status AS ENUM ('offline', 'online');
    CREATE TYPE ride_status AS ENUM (
      'requested', 'matched', 'driver_arrived', 'started', 'completed', 'cancelled'
    );
    CREATE TYPE pool_status AS ENUM ('forming', 'active', 'completed', 'cancelled');
    CREATE TYPE pool_history_event AS ENUM (
      'member_joined', 'member_left', 'status_changed', 'cancelled'
    );
    CREATE TYPE payment_method AS ENUM ('cash', 'teslapay_wallet');
    CREATE TYPE payment_status AS ENUM ('pending', 'paid');
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TYPE payment_status;
    DROP TYPE payment_method;
    DROP TYPE pool_history_event;
    DROP TYPE pool_status;
    DROP TYPE ride_status;
    DROP TYPE tesla_status;
    DROP TYPE user_role;
  `);
};
