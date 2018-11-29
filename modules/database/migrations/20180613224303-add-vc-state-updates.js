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
    DO $$
    BEGIN
      IF NOT EXISTS(SELECT 1
                    FROM pg_type
                    WHERE typname = 'eth_signature')
      THEN
        CREATE DOMAIN eth_signature AS VARCHAR(132)
          CHECK ( value ~* '^0x[a-f0-9]{130}$' );
      END IF;
    END$$;

    CREATE TABLE virtual_channel_state_updates (
      id                      BIGSERIAL PRIMARY KEY,
      channel_id              csw_sha3_hash               REFERENCES virtual_channels(channel_id),
      nonce                   BIGINT                      NOT NULL,
      wei_balance_a           wei_amount                  NOT NULL,
      wei_balance_b           wei_amount                  NOT NULL,
      sig_a                   eth_signature,
      sig_b                   eth_signature
    );
  `)
}

exports.down = function(db) {
  return null
}

exports._meta = {
  version: 1,
}
