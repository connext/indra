CREATE TABLE available_wallet_migrations (
  id BIGSERIAL PRIMARY KEY,
  migration_name VARCHAR NOT NULL
);

INSERT INTO
  available_wallet_migrations (migration_name)
VALUES
  ('close_channel'),
  ('request_booty_disbursement'),
  ('open_channel'),
  ('exchange_booty');

CREATE TABLE applied_wallet_migrations (
  id BIGSERIAL PRIMARY KEY,
  migration_id BIGSERIAL NOT NULL REFERENCES available_wallet_migrations(id),
  wallet_address VARCHAR NOT NULL,
  applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
