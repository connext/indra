'use strict';

var dbm;
var type;
var seed;

/**
  * We receive the dbmigrate dependency from dbmigrate initially.
  * This enables us to not have to rely on NODE_PATH.
  */
exports.setup = function(options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = function(db) {
  return db.runSql(`
    ALTER TABLE payment ADD COLUMN exchange_rate_id BIGINT NOT NULL REFERENCES exchange_rates(id);
    CREATE INDEX payment_exchange_rate_idx ON payment(exchange_rate_id); 
    
    CREATE OR REPLACE FUNCTION ts_to_millis(ts TIMESTAMP WITH TIME ZONE) RETURNS BIGINT AS $$
      SELECT FLOOR(EXTRACT(EPOCH FROM ts) * 1000)::BIGINT AS result;
    $$ LANGUAGE SQL IMMUTABLE;
    
    CREATE OR REPLACE FUNCTION now_millis() RETURNS BIGINT AS $$
      SELECT ts_to_millis(NOW()) AS result;
    $$ LANGUAGE SQL;
    
    CREATE OR REPLACE FUNCTION applicable_exchange_rate(
      IN ts BIGINT, 
      IN epsilon INTEGER DEFAULT 24 * 60 * 60 * 1000,
      OUT id BIGINT,
      OUT retrievedat BIGINT,
      OUT base VARCHAR,
      OUT rate_usd fiat_amount
    ) AS $$
      BEGIN
        SELECT e.id, e.retrievedat, e.base, e.rate_usd INTO id, retrievedat, base, rate_usd FROM exchange_rates e WHERE e.retrievedat <= ts AND ts - e.retrievedat <= epsilon ORDER BY e.retrievedat DESC LIMIT 1;
        IF (SELECT id) IS NULL THEN
          RAISE 'no valid exchange rate found within % ms', epsilon;
        END IF;
        RETURN;
      END;    
    $$ LANGUAGE plpgsql;
    
    CREATE OR REPLACE FUNCTION stamp_exchange_rate() RETURNS trigger AS $v$
      BEGIN
        NEW.exchange_rate_id := (SELECT id FROM applicable_exchange_rate(now_millis()));
        RETURN NEW;
      END;
    $v$ LANGUAGE plpgsql;
    
    CREATE TRIGGER stamp_exchange_rate BEFORE INSERT ON payment FOR EACH ROW EXECUTE PROCEDURE stamp_exchange_rate();
  `);
};

exports.down = function(db) {
  return db.removeColumn('tips', 'exchange_rate_id');
};

exports._meta = {
  "version": 1
};
