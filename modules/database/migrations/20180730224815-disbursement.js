'use strict'

var dbm
var type
var seed

/**
 * We receive the dbmigrate dependency from dbmigrate initially.
 * This enables us to not have to rely on NODE_PATH.
 */
exports.setup = function(options, seedLink) {
  dbm = options.dbmigrate
  type = dbm.dataType
  seed = seedLink
}

exports.up = function(db) {
  return db.runSql(`
    CREATE OR REPLACE FUNCTION validate_disbursement_status() RETURNS trigger AS $v$
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

    CREATE OR REPLACE FUNCTION disburesment_stamp_now() RETURNS trigger AS $q$
      BEGIN
        IF NEW.status = 'NEW' THEN
          NEW.createdat := (SELECT floor(extract(epoch from NOW()) * 1000));
        ELSE
          RAISE EXCEPTION 'invalid initial state';
        END IF;

        RETURN NEW;
      END;
    $q$ LANGUAGE plpgsql;

    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'disbursements_status') THEN
        CREATE TYPE disbursements_status AS ENUM('NEW', 'PENDING', 'CONFIRMED', 'FAILED');
      END IF;
    END$$;

    CREATE TABLE disbursements (
      id BIGSERIAL PRIMARY KEY,
      recipient VARCHAR NOT NULL,
      amountwei wei_amount,
      txhash VARCHAR,
      status disbursements_status NOT NULL,
      createdat BIGINT NOT NULL,
      pendingat BIGINT,
      confirmedat BIGINT,
      failedat BIGINT
    );
    CREATE UNIQUE INDEX require_single_pending_disbursement ON disbursements(recipient) WHERE (status = 'NEW' OR status = 'PENDING');
    CREATE INDEX disbursements_recipient ON disbursements (recipient);
    CREATE TRIGGER validate_status BEFORE UPDATE ON disbursements FOR EACH ROW EXECUTE PROCEDURE validate_disbursement_status();
    CREATE TRIGGER stamp_now BEFORE INSERT ON disbursements FOR EACH ROW EXECUTE PROCEDURE disburesment_stamp_now();`)
}

exports.down = function(db) {
  return null
}

exports._meta = {
  version: 1,
}
