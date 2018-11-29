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
    CREATE TABLE exchange_rates (
      id BIGSERIAL PRIMARY KEY,
      retrievedat BIGINT,
      base VARCHAR,
      rate_usd NUMERIC(78, 2)
    )
  `);
};

exports.down = function(db) {
  return db.dropTable('exchange_rates');
};

exports._meta = {
  "version": 1
};
