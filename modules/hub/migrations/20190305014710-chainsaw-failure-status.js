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
  Promise = options.Promise;
};

exports.up = function(db) {
  var filePath = path.join(__dirname, 'sqls', '20190305014710-chainsaw-failure-status-up.sql');
  return new Promise( function( resolve, reject ) {
    fs.readFile(filePath, {encoding: 'utf-8'}, function(err,data){
      if (err) return reject(err);
      console.log('received data: ' + data);

      resolve(data);
    });
  })
  .then(function(data) {
    // return db.runSql(data);
    // NOTE: this migration has been altered according to advice
    // on this thread: https://github.com/db-migrate/node-db-migrate/issues/424
    // this is a workaround the migrations in a transaction.
    db.endMigration()
    return db.runSql(`ALTER TYPE cm_channel_status ADD VALUE 'CS_CHAINSAW_ERROR';`)
    
  });
};

exports.down = function(db) {
  var filePath = path.join(__dirname, 'sqls', '20190305014710-chainsaw-failure-status-down.sql');
  return new Promise( function( resolve, reject ) {
    fs.readFile(filePath, {encoding: 'utf-8'}, function(err,data){
      if (err) return reject(err);
      console.log('received data: ' + data);

      resolve(data);
    });
  })
  .then(function(data) {
    return db.runSql(data);
  });
};

exports._meta = {
  "version": 1
};
