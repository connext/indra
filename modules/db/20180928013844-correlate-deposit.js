'use strict'

var dbm
var type
var seed

/**
 * We receive the dbmigrate dependency from dbmigrate initially.
 * This enables us to not have to rely on NODE_PATH.
 */
exports.setup = function(options, seedLink) {
  dbm = options.dbmigrate
  type = dbm.dataType
  seed = seedLink
}

exports.up = function(db) {
  return db.runSql(`
    ALTER TABLE chainsaw_ledger_channels_deposits 
      ADD COLUMN ledger_channel_state_updates_id BIGINT REFERENCES ledger_channel_state_updates(id);
  `)
}

exports.down = function(db) {
  return null
}

exports._meta = {
  version: 1,
}
