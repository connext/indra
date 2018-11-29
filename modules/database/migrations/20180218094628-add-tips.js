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
  return db.createTable('tips', {
    columns: {
      id: {
        type: 'bigint',
        primaryKey: true,
        autoIncrement: true
      },
      streamid: 'string',
      streamname: 'string',
      performerid: 'string',
      performername: 'string',
      performeraddress: 'string',
      paymenttoken: {
        type: 'string',
        notNull: true,
        foreignKey: {
          name: 'tips_payment_token_fk',
          table: 'payment',
          mapping: 'token',
          rules: {}
        }
      }
    }
  })
};

exports.down = function(db) {
  return db.dropTable('tips');
};

exports._meta = {
  "version": 1
};
