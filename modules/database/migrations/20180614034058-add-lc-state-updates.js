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
    CREATE TYPE ledger_channel_state_update_reason as enum (
      'VC_OPENED',    -- Update generated from opened VC.
      'VC_CLOSED',    -- Update generated from closed VC.
      'LC_DEPOSIT',   -- Update generated from on-chain deposit.
      'LC_FAST_CLOSE' -- Update generated from requested fast-close.
    );

    CREATE TABLE ledger_channel_state_updates (
      id                      BIGSERIAL PRIMARY KEY,
      is_close                SMALLINT                                NOT NULL,
      channel_id              csw_sha3_hash                           REFERENCES chainsaw_ledger_channels(channel_id),
      nonce                   BIGINT                                  NOT NULL,
      open_vcs                INTEGER                                 NOT NULL,
      vc_root_hash            csw_sha3_hash                           NOT NULL,
      wei_balance_a           wei_amount                              NOT NULL,
      wei_balance_i           wei_amount                              NOT NULL,
      reason                  ledger_channel_state_update_reason,
      vc_id                   csw_sha3_hash                           REFERENCES virtual_channels (channel_id),
      sig_a                   eth_signature,
      sig_i                   eth_signature
    );

    CREATE INDEX ledger_channel_state_updates_nonce_idx ON ledger_channel_state_updates(nonce);

    CREATE OR REPLACE VIEW hub_ledger_channels AS
      WITH lcs AS (
        SELECT
          csw.id                                                  id,
          csw.contract                                            contract,
          csw.channel_id                                          channel_id,
          coe.sender                                              party_a,
          CAST(coe.fields ->> 'partyI' AS csw_eth_address)        party_i,
          COALESCE(lcsu.wei_balance_a, csw.wei_balance_a_chain)   wei_balance_a,
          COALESCE(lcsu.wei_balance_i, csw.wei_balance_i_chain)   wei_balance_i,
          csw.wei_balance_a_chain                                 wei_balance_a_chain,
          csw.wei_balance_i_chain                                 wei_balance_i_chain,
          COALESCE(lcsu.nonce, 0)                                 nonce,
          COALESCE(lcsu.open_vcs, 0)                              open_vcs,
          COALESCE(lcsu.vc_root_hash, csw.vc_root_hash)           vc_root_hash,
          csw.status                                              status,
          csw.lc_opened_event_id                                  lc_opened_event_id,
          csw.lc_joined_event_id                                  lc_joined_event_id,
          csw.lc_start_settling_event_id                          lc_start_settling_event_id,
          csw.lc_closed_event_id                                  lc_closed_event_id
        FROM chainsaw_ledger_channels csw
          LEFT OUTER JOIN chainsaw_channel_events coe ON coe.id = csw.lc_opened_event_id
          LEFT OUTER JOIN ledger_channel_state_updates lcsu ON lcsu.channel_id = csw.channel_id
        )

        SELECT t1.* FROM lcs t1
        LEFT JOIN lcs t2
        ON t1.id = t2.id AND t1.nonce < t2.nonce
        WHERE t2.nonce IS NULL
        ORDER BY t1.nonce DESC
  `)
  // https://stackoverflow.com/questions/9796078/selecting-rows-ordered-by-some-column-and-distinct-on-another
}

exports.down = function(db) {
  return null
}

exports._meta = {
  version: 1,
}
