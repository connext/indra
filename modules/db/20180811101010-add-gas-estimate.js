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
    CREATE TABLE gas_estimates (
      id BIGSERIAL PRIMARY KEY,
      retrieved_at BIGINT,

      speed DOUBLE PRECISION,
      block_num BIGINT UNIQUE,
      block_time DOUBLE PRECISION,

      fastest DOUBLE PRECISION,
      fastest_wait DOUBLE PRECISION,

      fast DOUBLE PRECISION,
      fast_wait DOUBLE PRECISION,

      average DOUBLE PRECISION,
      avg_wait DOUBLE PRECISION,

      safe_low DOUBLE PRECISION,
      safe_low_wait DOUBLE PRECISION
    );
  `);
};

exports.down = function(db) {
  return db.runSql(`
    DROP TABLE gas_estimates;
  `);
};

exports._meta = {
  "version": 1
};
