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
    CREATE OR REPLACE VIEW payments AS
    SELECT 
      p."channelId" "channelId",
      p.price "amountwei",
      wei_to_fiat(p.price, e.rate_usd) AS amountusd,
      p.sender "sender",
      m.receiver "receiver",
      e.rate_usd "rate_usd",
      p.withdrawal_id "withdrawal_id",
      p."createdAt" "created_at",
      m.fields "fields"
    FROM payment p
    JOIN exchange_rates e ON p.exchange_rate_id = e.id
    JOIN payment_meta m ON m.paymenttoken = p.token;
    
    INSERT INTO payment_meta (paymenttoken, receiver, type, fields) 
    (
      SELECT paymenttoken, performeraddress, 'TIP' as type, 
      (
        SELECT row_to_json(r) FROM (
          SELECT streamid AS "streamId", streamname AS "streamName", performerid AS "performerId", performername AS "performerName" FROM tips t JOIN payment p ON p.token = t.paymenttoken WHERE t.paymenttoken = tips.paymenttoken
        ) r
      ) AS fields
      FROM tips
    );
    
    DROP TABLE tips;
  `);
};

exports.down = function(db) {
  return null;
};

exports._meta = {
  "version": 1
};
