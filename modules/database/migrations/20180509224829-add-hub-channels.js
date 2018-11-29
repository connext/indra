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
    CREATE INDEX payment_channelId_idx
      ON payment ("channelId");
    
    CREATE OR REPLACE VIEW hub_channels AS
      SELECT
        csw.id                                 id,
        csw.contract                           contract,
        csw.channel_id                         channel_id,
        csw.wei_value                          wei_value,
        csw.status                             status,
        csw.opened_event_id                    opened_event_id,
        csw.start_settling_event_id            start_settling_event_id,
        csw.settled_event_id                   settled_event_id,
        csw.claim_event_id                     claim_event_id,
        coe.sender                             sender,
        coe.fields ->> 'receiver'              receiver,
        coe.fields ->> 'settlingPeriod'        settling_period,
        COALESCE(p.value, 0)                   wei_spent,
        (csw.wei_value - COALESCE(p.value, 0)) wei_remaining
      FROM chainsaw_channels csw
        JOIN chainsaw_channel_events coe ON coe.id = csw.opened_event_id
        LEFT OUTER JOIN (
          SELECT "channelId", MAX(value) as value
          FROM payment p
        GROUP BY p."channelId"
        ) p ON p."channelId" = csw.channel_id;
  `);
};

exports.down = function(db) {
  return null;
};

exports._meta = {
  "version": 1
};
