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
  INSERT INTO pg_enum (enumtypid, enumlabel, enumsortorder)
    SELECT 'ledger_channel_state_update_reason'::regtype::oid, 'LC_PAYMENT', ( SELECT MAX(enumsortorder) + 1 FROM pg_enum WHERE enumtypid = 'ledger_channel_state_update_reason'::regtype );`)
}

exports.down = function(db) {
  return null
}

exports._meta = {
  version: 1,
}
