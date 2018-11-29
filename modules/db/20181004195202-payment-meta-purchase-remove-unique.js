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
    ALTER TABLE "public"."payment_meta"   DROP CONSTRAINT "payment_meta_purchase_key";
    CREATE INDEX payment_meta_purchase ON payment_meta(purchase);
  `);
};

exports.down = function(db) {
  return null;
};

exports._meta = {
  "version": 1
};
