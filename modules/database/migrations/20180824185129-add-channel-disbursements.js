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
    ALTER TABLE withdrawals DISABLE TRIGGER validate_status;
    ALTER TABLE withdrawals ADD COLUMN initiator VARCHAR;
    UPDATE withdrawals SET initiator = recipient;
    ALTER TABLE withdrawals ALTER COLUMN initiator SET NOT NULL;
    ALTER TABLE withdrawals ENABLE TRIGGER validate_status;

    --INSERT INTO pg_enum (enumtypid, enumlabel, enumsortorder)
    --  SELECT 'calculation_method'::regtype::oid, 'CHANNEL_DISBURSEMENT', ( SELECT MAX(enumsortorder) + 1 FROM pg_enum WHERE enumtypid = 'calculation_method'::regtype );
    --
    --CREATE OR REPLACE FUNCTION create_withdrawal_channel_disbursement(_initiator TEXT, _recipient TEXT, _amountwei wei_amount) RETURNS BIGINT AS $$
    --DECLARE
    --  _rate fiat_amount;
    --  _amountusd fiat_amount;
    --  _id BIGINT;
    --  _rate_id BIGINT;
    --  _now BIGINT;
    --BEGIN
    --  -- Return values: -1 if there's no available payment. A numeric ID otherwise.
    --  SELECT now_millis() INTO _now;
    --
    --  SELECT rate_usd, id INTO _rate, _rate_id FROM applicable_exchange_rate(_now);
    --  SELECT wei_to_fiat(_amountwei, _rate) INTO _amountusd;
    --  
    --  INSERT INTO withdrawals(initiator, recipient, amountusd, amountwei, exchange_rate_id, status, createdat, method) VALUES (_initiator, _recipient, _amountusd, _amountwei, _rate_id, 'NEW', _now, 'CHANNEL_DISBURSEMENT') RETURNING id INTO _id;
    --  UPDATE payment SET withdrawal_id = _id WHERE token in (select token from payments where receiver = _recipient AND withdrawal_id IS NULL);
    --  RETURN _id;
    --END;
    --$$ LANGUAGE plpgsql;
  `);
};

exports.down = function(db) {
  return null;
};

exports._meta = {
  "version": 1
};
