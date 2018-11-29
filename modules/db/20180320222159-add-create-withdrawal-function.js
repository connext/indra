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
      
      INSERT INTO withdrawals(recipient, amountusd, amountwei, exchange_rate_id, status, createdat) VALUES (_recipient, _amountusd, _amountwei, _rate_id, 'NEW', _now) RETURNING id INTO _id;
      UPDATE payment SET withdrawal_id = _id WHERE sender = _recipient AND withdrawal_id IS NULL;
      RETURN _id;
    END;
    $$ LANGUAGE plpgsql;
  `);
};

exports.down = function(db) {
  return db.runSql('DROP FUNCTION create_withdrawal_usd_amount(recipient TEXT)');
};

exports._meta = {
  "version": 1
};
