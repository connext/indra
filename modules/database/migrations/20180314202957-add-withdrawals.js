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
    DO $$
    BEGIN
        CREATE DOMAIN wei_amount AS NUMERIC(78,0);
    END$$;
    
    DO $$
    BEGIN
        CREATE DOMAIN fiat_amount AS NUMERIC(78,2);
    END$$;
  
    CREATE OR REPLACE FUNCTION validate_status() RETURNS trigger AS $v$
      BEGIN
        IF NEW.status = 'PENDING' THEN
          IF OLD.status != 'NEW' THEN
              RAISE EXCEPTION 'invalid state transition';
          END IF;
    
          NEW.pendingat := (SELECT floor(extract(epoch from NOW()) * 1000));
        END IF;
    
        IF NEW.status = 'CONFIRMED' THEN
          IF OLD.status != 'PENDING' THEN
              RAISE EXCEPTION 'invalid state transition';
          END IF;
    
          NEW.confirmedat := (SELECT floor(extract(epoch from NOW()) * 1000));
        END IF;
        
        IF NEW.status = 'FAILED' THEN
          IF OLD.status != 'PENDING' AND OLD.status != 'NEW' THEN
            RAISE EXCEPTION 'invalid state transition';
          END IF;
    
          NEW.failedat := (SELECT floor(extract(epoch from NOW()) * 1000));
        END IF;
        
        RETURN NEW;
      END;
    $v$ LANGUAGE plpgsql;

    DO $$
    BEGIN
        CREATE TYPE withdrawal_status AS ENUM('NEW', 'PENDING', 'CONFIRMED', 'FAILED');
    END$$;

    CREATE TABLE withdrawals (
      id BIGSERIAL PRIMARY KEY,
      recipient VARCHAR NOT NULL,
      amountwei wei_amount,
      amountusd fiat_amount,
      txhash VARCHAR,
      status withdrawal_status NOT NULL,
      exchange_rate_id BIGINT NOT NULL REFERENCES exchange_rates(id),
      createdat BIGINT NOT NULL,
      pendingat BIGINT,
      confirmedat BIGINT,
      failedat BIGINT
    );
    CREATE UNIQUE INDEX require_single_pending ON withdrawals(recipient) WHERE (status = 'NEW' OR status = 'PENDING');
    CREATE INDEX withdrawals_recipient ON withdrawals (recipient);
    CREATE TRIGGER validate_status BEFORE UPDATE ON withdrawals FOR EACH ROW EXECUTE PROCEDURE validate_status();
  `);
};

exports.down = function(db) {
  return db.dropTable('withdrawals');
};

exports._meta = {
  "version": 1
};
