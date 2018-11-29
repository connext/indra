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
    CREATE OR REPLACE FUNCTION wei_to_fiat(amount_wei wei_amount, exchange_rate NUMERIC(78, 2)) RETURNS NUMERIC(78, 2) AS $$
      SELECT (amount_wei * exchange_rate * 1e-18) AS result
    $$ LANGUAGE SQL;
    
    CREATE OR REPLACE FUNCTION fiat_to_wei(amount_usd fiat_amount, exchange_rate NUMERIC(78, 2)) RETURNS NUMERIC(78, 0) AS $$
      SELECT (amount_usd / exchange_rate * 1e18) AS result
    $$ LANGUAGE SQL;
  
    CREATE OR REPLACE VIEW payments AS
    SELECT 
      p."channelId" "channelId",
      p.price "amountwei",
      wei_to_fiat(p.price, e.rate_usd) AS amountusd,
      p.sender "sender",
      t.performeraddress "receiver",
      e.rate_usd "rate_usd",
      p.withdrawal_id "withdrawal_id",
      p."createdAt" "created_at"
    FROM payment p 
    JOIN exchange_rates e ON p.exchange_rate_id = e.id
    JOIN tips t ON t.paymenttoken = p.token
  `);
};

exports.down = function(db) {
  return db.runSql('DROP VIEW payments');
};

exports._meta = {
  "version": 1
};
