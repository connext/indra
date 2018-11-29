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
    ALTER TABLE virtual_channel_state_updates ADD COLUMN created_at BIGINT;

    CREATE OR REPLACE VIEW payments AS
      SELECT
             COALESCE(vcsu.channel_id, lcsu.channel_id)                                                                    channel_id,
             COALESCE(vcsu.price, lcsu.price, p.price)                                                                     "amountwei",
             wei_to_fiat(COALESCE(vcsu.price, lcsu.price, p.price), COALESCE(e.rate_usd, el.rate_usd, ep.rate_usd)) AS     amountusd,
             COALESCE(v.party_a, lc.party_a, p.sender)                                                                     "sender",
             COALESCE(v.party_b, lc.party_i, m.receiver)                                                                   "receiver",
             COALESCE(e.rate_usd, el.rate_usd, ep.rate_usd)                                                                "rate_usd",
             m.fields                                                                                                      "fields",
             m.type                                                                                                        "type",
             COALESCE(CAST(m.vcupdatetoken AS VARCHAR), CAST(m.lcupdatetoken AS VARCHAR), m.paymenttoken)                  token,
             p.withdrawal_id                                                                                               "withdrawal_id",
             COALESCE(p."createdAt", vcsu.created_at)                                                                      "created_at"
      FROM payment_meta m
             LEFT OUTER JOIN virtual_channel_state_updates vcsu ON vcsu.id = m.vcupdatetoken
             LEFT OUTER JOIN virtual_channels v ON vcsu.channel_id = v.channel_id
             LEFT OUTER JOIN exchange_rates e ON vcsu.exchange_rate_id = e.id
             LEFT OUTER JOIN ledger_channel_state_updates lcsu ON lcsu.id = m.lcupdatetoken
             LEFT OUTER JOIN hub_ledger_channels lc ON lcsu.channel_id = lc.channel_id
             LEFT OUTER JOIN exchange_rates el ON lcsu.exchange_rate_id = el.id
             LEFT OUTER JOIN payment p ON p.token = m.paymenttoken
             LEFT OUTER JOIN exchange_rates ep ON p.exchange_rate_id = ep.id;
  `);
};

exports.down = function(db) {
  return null;
};

exports._meta = {
  "version": 1
};
