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
    ALTER TABLE _cm_channels ADD COLUMN channel_dispute_id BIGINT NULL;
    ALTER TABLE _cm_channels DROP CONSTRAINT _cm_channels_check;
    ALTER TABLE _cm_channels ADD CONSTRAINT _cm_channels_check CHECK (
      CASE status
      WHEN 'CS_CHANNEL_DISPUTE' THEN
          channel_dispute_id IS NOT NULL AND
          thread_dispute_event_id IS NULL
      WHEN 'CS_THREAD_DISPUTE' then
          channel_dispute_id IS NULL AND
          thread_dispute_event_id IS NOT NULL
      END
    );
  `);
};

exports.down = function(db) {
  // TODO: not sure how to handle this
  return db.runSql(`
    ALTER TABLE _cm_channels DROP COLUMN channel_dispute_id
  `);
};

exports._meta = {
  "version": 1
};
