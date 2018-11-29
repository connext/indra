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
    CREATE TABLE payment_meta (
      paymenttoken VARCHAR NOT NULL REFERENCES payment(token),
      receiver VARCHAR NOT NULL,
      type VARCHAR NOT NULL,
      fields jsonb
      CONSTRAINT valid_receiver CHECK (receiver ~* '^0x[a-fA-F0-9]{40}$')
    );
    
    CREATE UNIQUE INDEX payment_meta_paymenttoken ON payment_meta(paymenttoken);
  `);
};

exports.down = function(db) {
  return db.dropTable('payment_meta');
};

exports._meta = {
  "version": 1
};
