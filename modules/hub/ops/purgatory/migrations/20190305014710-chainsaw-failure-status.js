'use strict';

var dbm;
var type;
var seed;
var fs = require('fs');
var path = require('path');
var Promise;

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
  db.endMigration()
  return db.runSql(`ALTER TYPE cm_channel_status ADD VALUE 'CS_CHAINSAW_ERROR';`)
};

exports.down = function(db) {
  return null
};

exports._meta = {
  "version": 1
};
