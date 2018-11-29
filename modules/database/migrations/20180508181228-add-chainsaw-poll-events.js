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
    create extension citext;

    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'csw_eth_address') THEN
        CREATE DOMAIN csw_eth_address as citext
        CHECK ( value ~* '^0x[a-f0-9]{40}$' );
      END IF;
    END$$;
  
    CREATE TABLE chainsaw_poll_events (
      block_number BIGINT NOT NULL UNIQUE,
      polled_at BIGINT NOT NULL,
      contract csw_eth_address NOT NULL
    );
  `);
};

exports.down = function(db) {
  return null;
};

exports._meta = {
  "version": 1
};
