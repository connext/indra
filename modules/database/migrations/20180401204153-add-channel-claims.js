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
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'channel_claim_status') THEN
        CREATE TYPE channel_claim_status AS ENUM('NEW', 'PENDING', 'CONFIRMED', 'FAILED');
      END IF;
    END$$;
  
    CREATE TABLE channel_claims (
      channel_id VARCHAR REFERENCES channel("channelId"),
      status channel_claim_status NOT NULL,
      createdat BIGINT NOT NULL,
      pendingat BIGINT,
      confirmedat BIGINT,
      failedat BIGINT
    );
    
    CREATE UNIQUE INDEX require_single_pending_channel_claim ON channel_claims(channel_id) WHERE (status = 'NEW' OR status = 'PENDING' OR status = 'CONFIRMED');
    CREATE INDEX channel_claims_channel_id ON channel_claims(channel_id);
    CREATE TRIGGER validate_status_channel_claims BEFORE UPDATE ON channel_claims FOR EACH ROW EXECUTE PROCEDURE validate_status();
  `);
};

exports.down = function(db) {
  return db.dropTable('channel_claims');
};

exports._meta = {
  "version": 1
};
