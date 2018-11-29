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
  ALTER TABLE ledger_channel_state_updates ADD COLUMN erc20_balance_a wei_amount NOT NULL;
  ALTER TABLE ledger_channel_state_updates ADD COLUMN erc20_balance_i wei_amount NOT NULL;

  DROP VIEW IF EXISTS payments;
  DROP VIEW IF EXISTS hub_ledger_channels;

  CREATE OR REPLACE VIEW hub_ledger_channels AS
    WITH lcs AS (
      SELECT
        csw.id                                                      id,
        csw.contract                                                contract,
        csw.channel_id                                              channel_id,
        coe.sender                                                  party_a,
        CAST(coe.fields ->> 'partyI' AS csw_eth_address)            party_i,
        COALESCE(lcsu.wei_balance_a, csw.wei_balance_a_chain)       wei_balance_a,
        COALESCE(lcsu.wei_balance_i, csw.wei_balance_i_chain)       wei_balance_i,
        csw.token                                                   token,
        COALESCE(lcsu.erc20_balance_a, csw.erc20_balance_a_chain)   erc20_balance_a,
        COALESCE(lcsu.erc20_balance_i, csw.erc20_balance_i_chain)   erc20_balance_i,
        csw.wei_balance_a_chain                                     wei_balance_a_chain,
        csw.wei_balance_i_chain                                     wei_balance_i_chain,
        COALESCE(lcsu.nonce, 0)                                     nonce,
        COALESCE(lcsu.open_vcs, 0)                                  open_vcs,
        COALESCE(lcsu.vc_root_hash, csw.vc_root_hash)               vc_root_hash,
        csw.status                                                  status,
        csw.lc_opened_event_id                                      lc_opened_event_id,
        csw.lc_joined_event_id                                      lc_joined_event_id,
        csw.lc_start_settling_event_id                              lc_start_settling_event_id,
        csw.lc_closed_event_id                                      lc_closed_event_id
      FROM chainsaw_ledger_channels csw
        LEFT OUTER JOIN chainsaw_channel_events coe ON coe.id = csw.lc_opened_event_id
        LEFT OUTER JOIN ledger_channel_state_updates lcsu ON lcsu.channel_id = csw.channel_id
      )

      SELECT t1.* FROM lcs t1
      LEFT JOIN lcs t2
      ON t1.id = t2.id AND t1.nonce < t2.nonce
      WHERE t2.nonce IS NULL
      ORDER BY t1.nonce DESC;

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
      p."createdAt"                                                                                                 "created_at"
    FROM payment_meta m
    LEFT OUTER JOIN virtual_channel_state_updates vcsu ON vcsu.id = m.vcupdatetoken
    LEFT OUTER JOIN virtual_channels v ON vcsu.channel_id = v.channel_id
    LEFT OUTER JOIN exchange_rates e ON vcsu.exchange_rate_id = e.id
    LEFT OUTER JOIN ledger_channel_state_updates lcsu ON lcsu.id = m.lcupdatetoken
    LEFT OUTER JOIN hub_ledger_channels lc ON lcsu.channel_id = lc.channel_id
    LEFT OUTER JOIN exchange_rates el ON lcsu.exchange_rate_id = el.id
    LEFT OUTER JOIN payment p ON p.token = m.paymenttoken
    LEFT OUTER JOIN exchange_rates ep ON p.exchange_rate_id = ep.id;
  `)
}

exports.down = function(db) {
  return null
}

exports._meta = {
  version: 1,
}
