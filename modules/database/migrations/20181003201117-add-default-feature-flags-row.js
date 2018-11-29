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
    CREATE UNIQUE INDEX feature_flags_address ON feature_flags (address);
    INSERT INTO feature_flags (address, booty_support)
    VALUES ('0x0000000000000000000000000000000000000000', false)
    ON CONFLICT (address) DO NOTHING;
  `)
};

exports.down = function(db) {
  return db.runSql(`
    DROP INDEX feature_flags_address;
    DELETE FROM feature_flags
    WHERE address = '0x0000000000000000000000000000000000000000';
  `)
};

exports._meta = {
  "version": 1
};
