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
  // TODO finish adding events
  return db.runSql(`
    CREATE TYPE csw_virtual_channel_state as enum (
      'VCS_OPENING',  -- Channel opened, waiting for participant to join
      'VCS_OPENED',   -- Open for business
      'VCS_SETTLING', -- Sender has requested settlement
      'VCS_SETTLED'   -- Channel has been settled
    );
  
    CREATE TABLE virtual_channels (
      id                          BIGSERIAL PRIMARY KEY,
      channel_id                  csw_sha3_hash               NOT NULL UNIQUE,
      party_a                     csw_eth_address             NOT NULL,
      party_b                     csw_eth_address             NOT NULL,
      party_i                     csw_eth_address             NOT NULL,
      subchan_a_to_i              csw_sha3_hash               REFERENCES chainsaw_ledger_channels(channel_id),
      subchan_b_to_i              csw_sha3_hash               REFERENCES chainsaw_ledger_channels(channel_id),
      status                      csw_virtual_channel_state   NOT NULL,
      on_chain_nonce              BIGINT,
      update_timeout              BIGINT,

      vc_init_event_id            BIGINT REFERENCES chainsaw_channel_events (id),
      vc_start_settling_event_id  BIGINT REFERENCES chainsaw_channel_events (id),
      vc_settled_event_id         BIGINT REFERENCES chainsaw_channel_events (id)
    );
  `)
}

exports.down = function(db) {
  return null
}

exports._meta = {
  version: 1,
}
