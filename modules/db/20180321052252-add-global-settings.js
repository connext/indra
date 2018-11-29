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
    CREATE TABLE global_settings (
      withdrawals_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      payments_enabled BOOLEAN NOT NULL DEFAULT TRUE
    );
    INSERT INTO global_settings (withdrawals_enabled, payments_enabled) VALUES (TRUE, TRUE);
  `);
};

exports.down = function(db) {
  return db.dropTable('global_settings');
};

exports._meta = {
  "version": 1
};
