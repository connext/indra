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
    ALTER TABLE payment ADD COLUMN withdrawal_id BIGINT REFERENCES withdrawals(id);
    CREATE INDEX payment_withdrawal_id ON payment(withdrawal_id);
  `);
};

exports.down = function(db) {
  return db.removeColumn('payment', 'withdrawal_id');
};

exports._meta = {
  "version": 1
};
