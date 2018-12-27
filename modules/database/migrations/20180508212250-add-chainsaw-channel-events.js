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
    DO $$
    BEGIN
        CREATE DOMAIN csw_sha3_hash AS citext
          CHECK ( value ~* '^0x[a-f0-9]{64}$' );
    END$$;
    
    DO $$
    BEGIN
        CREATE TYPE csw_channel_event_type AS ENUM (
          'DidOpen', -- (bytes32 indexed channelId, address indexed sender, address indexed receiver, uint256 value)
          'DidDeposit', -- (bytes32 indexed channelId, uint256 deposit)
          'DidClaim', -- (bytes32 indexed channelId)
          'DidStartSettling', -- (bytes32 indexed channelId)
          'DidSettle' -- (bytes32 indexed channelId)
        );
    END$$;
    
    CREATE TABLE chainsaw_channel_events (
      id             BIGSERIAL PRIMARY KEY,
      contract       csw_eth_address        NOT NULL,
      channel_id     csw_sha3_hash          NOT NULL,
    
      -- The block's timestamp, number, and hash.
      ts             BIGINT                 NOT NULL,
      block_number   INT                    NOT NULL,
      block_hash     csw_sha3_hash          NOT NULL,
    
      -- Whether this block is valid and should be considered in the channel's
      -- state. Always true initially, but set to false by
      -- csw_set_recent_blocks if this block is orphaned by a reorg.
      is_valid_block BOOLEAN                NOT NULL,
    
      -- The event's sender
      sender         csw_eth_address        NOT NULL,
    
      -- The event's type ('DidOpen', etc) and event-specific fields
      -- as defined by the broker contract ('value', 'payment', etc).
      event_type     csw_channel_event_type NOT NULL,
      fields         JSONB
    );
  `);
};

exports.down = function(db) {
  return null;
};

exports._meta = {
  "version": 1
};
