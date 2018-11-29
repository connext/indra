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
    ALTER TABLE virtual_channel_state_updates 
      ADD COLUMN          exchange_rate_id    BIGINT          NOT NULL REFERENCES exchange_rates(id),
      ADD COLUMN          price               wei_amount      NOT NULL;
    CREATE INDEX virtual_channel_state_updates_exchange_rate_idx ON virtual_channel_state_updates(exchange_rate_id);

    CREATE TRIGGER stamp_exchange_rate BEFORE INSERT ON virtual_channel_state_updates FOR EACH ROW EXECUTE PROCEDURE stamp_exchange_rate();

    DROP VIEW IF EXISTS payments;

    ALTER TABLE payment_meta ALTER COLUMN paymenttoken DROP NOT NULL;
    ALTER TABLE payment_meta ADD COLUMN updatetoken BIGINT REFERENCES virtual_channel_state_updates(id);
  
    CREATE UNIQUE INDEX payment_meta_updatetoken ON payment_meta(updatetoken);

    CREATE OR REPLACE VIEW payments AS
      SELECT 
        vcsu.channel_id                                                                     channel_id,
        COALESCE(vcsu.price, p.price)                                                       "amountwei",
        wei_to_fiat(COALESCE(vcsu.price, p.price), COALESCE(e.rate_usd, ep.rate_usd)) AS    amountusd,
        COALESCE(v.party_a, p.sender)                                                       "sender",
        COALESCE(v.party_b, m.receiver)                                                     "receiver",
        COALESCE(e.rate_usd, ep.rate_usd)                                                   "rate_usd",
        m.fields                                                                            "fields",
        m.type                                                                              "type",
        m.paymenttoken                                                                      token,
        p.withdrawal_id                                                                     "withdrawal_id",
        p."createdAt"                                                                       "created_at"
      FROM payment_meta m
    JOIN virtual_channel_state_updates vcsu ON vcsu.id = m.updatetoken
    JOIN virtual_channels v ON vcsu.channel_id = v.channel_id
    JOIN exchange_rates e ON vcsu.exchange_rate_id = e.id
    JOIN payment p ON p.token = m.paymenttoken
    JOIN exchange_rates ep ON p.exchange_rate_id = ep.id;

  `)
}

exports.down = function(db) {
  return null
}

exports._meta = {
  version: 1,
}
