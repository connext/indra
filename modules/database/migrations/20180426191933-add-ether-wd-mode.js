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
        CREATE TYPE calculation_method AS ENUM('WEI_SUM', 'PEGGED_FIAT');
    END$$;
  
    ALTER TABLE withdrawals ADD COLUMN method calculation_method;
    
    DROP TRIGGER validate_status ON withdrawals; 
    UPDATE withdrawals SET method = 'PEGGED_FIAT';
    CREATE TRIGGER validate_status BEFORE UPDATE ON withdrawals FOR EACH ROW EXECUTE PROCEDURE validate_status();
    
    ALTER TABLE withdrawals ALTER COLUMN method SET NOT NULL; 
  
    CREATE OR REPLACE FUNCTION create_withdrawal_wei_amount(_recipient TEXT) RETURNS BIGINT AS $$
    DECLARE
      _rate fiat_amount;
      _amountwei wei_amount;
      _amountusd fiat_amount;
      _id BIGINT;
      _rate_id BIGINT;
      _now BIGINT;
    BEGIN
      -- Return values: -1 if there's no available payment. A numeric ID otherwise.
      SELECT now_millis() INTO _now;
       
      LOCK TABLE payment IN SHARE ROW EXCLUSIVE MODE;
      IF (SELECT NOT EXISTS(SELECT 1 FROM payments WHERE receiver = _recipient AND withdrawal_id IS NULL)) THEN
        RETURN -1;
      END IF;
    
      SELECT rate_usd, id INTO _rate, _rate_id FROM applicable_exchange_rate(_now);
      SELECT INTO _amountwei SUM(amountwei) FROM payments WHERE receiver = _recipient AND withdrawal_id IS NULL;
      SELECT wei_to_fiat(_amountwei, _rate) INTO _amountusd;
      
      INSERT INTO withdrawals(recipient, amountusd, amountwei, exchange_rate_id, status, createdat, method) VALUES (_recipient, _amountusd, _amountwei, _rate_id, 'NEW', _now, 'WEI_SUM') RETURNING id INTO _id;
      UPDATE payment SET withdrawal_id = _id WHERE withdrawal_id IS NULL;
      RETURN _id;
    END;
    $$ LANGUAGE plpgsql;
    
    CREATE OR REPLACE FUNCTION create_withdrawal_usd_amount(_recipient TEXT) RETURNS BIGINT AS $$
    DECLARE
      _rate fiat_amount;
      _amountwei wei_amount;
      _amountusd fiat_amount;
      _id BIGINT;
      _rate_id BIGINT;
      _now BIGINT;
    BEGIN
      -- Return values: -1 if there's no available payment. A numeric ID otherwise.
      SELECT now_millis() INTO _now;
       
      LOCK TABLE payment IN SHARE ROW EXCLUSIVE MODE;
      IF (SELECT NOT EXISTS(SELECT 1 FROM payments WHERE receiver = _recipient AND withdrawal_id IS NULL)) THEN
        RETURN -1;
      END IF;
    
      SELECT rate_usd, id INTO _rate, _rate_id FROM applicable_exchange_rate(_now);
      SELECT INTO _amountusd SUM(amountusd) FROM payments WHERE receiver = _recipient AND withdrawal_id IS NULL;
      SELECT fiat_to_wei(_amountusd, _rate) INTO _amountwei;
      
      INSERT INTO withdrawals(recipient, amountusd, amountwei, exchange_rate_id, status, createdat, method) VALUES (_recipient, _amountusd, _amountwei, _rate_id, 'NEW', _now, 'PEGGED_FIAT') RETURNING id INTO _id;
      UPDATE payment SET withdrawal_id = _id WHERE withdrawal_id IS NULL;
      RETURN _id;
    END;
    $$ LANGUAGE plpgsql;
  `);
};

exports.down = function(db) {
  return null;
};

exports._meta = {
  "version": 1
};
