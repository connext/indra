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
  --INSERT INTO pg_enum (enumtypid, enumlabel, enumsortorder)
  --  SELECT 'csw_channel_event_type'::regtype::oid, 'DidLCOpen', ( SELECT MAX(enumsortorder) + 1 FROM pg_enum WHERE enumtypid = 'csw_channel_event_type'::regtype );
  --INSERT INTO pg_enum (enumtypid, enumlabel, enumsortorder)
  --  SELECT 'csw_channel_event_type'::regtype::oid, 'DidLCJoin', ( SELECT MAX(enumsortorder) + 1 FROM pg_enum WHERE enumtypid = 'csw_channel_event_type'::regtype );
  --INSERT INTO pg_enum (enumtypid, enumlabel, enumsortorder)
  --  SELECT 'csw_channel_event_type'::regtype::oid, 'DidLCDeposit', ( SELECT MAX(enumsortorder) + 1 FROM pg_enum WHERE enumtypid = 'csw_channel_event_type'::regtype );
  --INSERT INTO pg_enum (enumtypid, enumlabel, enumsortorder)
  --  SELECT 'csw_channel_event_type'::regtype::oid, 'DidLCClose', ( SELECT MAX(enumsortorder) + 1 FROM pg_enum WHERE enumtypid = 'csw_channel_event_type'::regtype );
  --INSERT INTO pg_enum (enumtypid, enumlabel, enumsortorder)
  --  SELECT 'csw_channel_event_type'::regtype::oid, 'DidLCUpdateState', ( SELECT MAX(enumsortorder) + 1 FROM pg_enum WHERE enumtypid = 'csw_channel_event_type'::regtype );
  --INSERT INTO pg_enum (enumtypid, enumlabel, enumsortorder)
  --  SELECT 'csw_channel_event_type'::regtype::oid, 'DidVCInit', ( SELECT MAX(enumsortorder) + 1 FROM pg_enum WHERE enumtypid = 'csw_channel_event_type'::regtype );
  --INSERT INTO pg_enum (enumtypid, enumlabel, enumsortorder)
  --  SELECT 'csw_channel_event_type'::regtype::oid, 'DidVCSettle', ( SELECT MAX(enumsortorder) + 1 FROM pg_enum WHERE enumtypid = 'csw_channel_event_type'::regtype );
  --INSERT INTO pg_enum (enumtypid, enumlabel, enumsortorder)
  --  SELECT 'csw_channel_event_type'::regtype::oid, 'DidVCClose', ( SELECT MAX(enumsortorder) + 1 FROM pg_enum WHERE enumtypid = 'csw_channel_event_type'::regtype );
  `)

  /*
  Reference for this code: https://stackoverflow.com/questions/1771543/postgresql-updating-an-enum-type/41696273#41696273

  event DidLCOpen (
      bytes32 indexed channelId,
      address indexed partyA,
      address indexed partyI,
      uint256 balanceA
  );
  event DidLCJoin (
      bytes32 indexed channelId,
      uint256 balanceI
  );
  event DidLCDeposit (
      bytes32 indexed channelId,
      address indexed recipient,
      uint256 deposit
  );
  event DidLCUpdateState (
      bytes32 indexed channelId, 
      uint256 sequence, 
      uint256 numOpenVc, 
      uint256 balanceA, 
      uint256 balanceI, 
      bytes32 vcRoot,
      uint256 updateLCtimeout
  );
  event DidLCClose (
      bytes32 indexed channelId,
      uint256 sequence,
      uint256 balanceA,
      uint256 balanceI
  );
  event DidVCInit (
      bytes32 indexed lcId, 
      bytes32 indexed vcId, 
      bytes proof, 
      uint256 sequence, 
      address partyA, 
      address partyB, 
      uint256 balanceA, 
      uint256 balanceB 
  );

  event DidVCSettle (
      bytes32 indexed lcId, 
      bytes32 indexed vcId,
      uint256 updateSeq, 
      address partyA, 
      address partyB, 
      uint256 updateBalA, 
      uint256 updateBalB,
      address challenger
  );

  event DidVCClose(
      bytes32 indexed lcId, 
      bytes32 indexed vcId, 
      uint256 balanceA, 
      uint256 balanceB
  );
  */
}

exports.down = function(db) {
  return null
}

exports._meta = {
  version: 1,
}
