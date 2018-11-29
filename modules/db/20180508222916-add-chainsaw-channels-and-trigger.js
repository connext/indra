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
    CREATE TYPE csw_channel_state as enum (
      'CS_OPEN',     -- Open for business
      'CS_SETTLING', -- Sender has requested settlement
      'CS_SETTLED'   -- Channel has been settled
    );
  
    CREATE TABLE chainsaw_channels (
      id                      BIGSERIAL PRIMARY KEY,
      contract                csw_eth_address   NOT NULL,
      channel_id              csw_sha3_hash     NOT NULL UNIQUE,
      wei_value               wei_amount        NOT NULL,
      status                  csw_channel_state NOT NULL,
    
      opened_event_id         BIGINT REFERENCES chainsaw_channel_events (id),
      start_settling_event_id BIGINT REFERENCES chainsaw_channel_events (id),
      settled_event_id        BIGINT REFERENCES chainsaw_channel_events (id),
      claim_event_id          BIGINT REFERENCES chainsaw_channel_events (id)
    );
    
    CREATE TABLE chainsaw_channels_deposits (
      channel_id csw_sha3_hash REFERENCES chainsaw_channels(channel_id),
      deposit_event_id BIGINT  REFERENCES chainsaw_channel_events(id)
    );
    
    CREATE OR REPLACE FUNCTION materialize_chainsaw_channel() RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.event_type = 'DidOpen' THEN
        INSERT INTO chainsaw_channels (contract, channel_id, wei_value, opened_event_id, status)
          VALUES (NEW.contract, NEW.channel_id, CAST(NEW.fields->>'value' AS wei_amount), NEW.id, 'CS_OPEN');
      END IF;
    
      IF NEW.event_type = 'DidDeposit' THEN
        UPDATE chainsaw_channels SET wei_value = wei_value + CAST(NEW.fields->>'value' AS wei_amount)
          WHERE channel_id = NEW.channel_id;
        INSERT INTO chainsaw_channels_deposits (channel_id, deposit_event_id)
          VALUES (NEW.channel_id, NEW.id);
      END IF;
    
      IF NEW.event_type = 'DidClaim' THEN
        UPDATE chainsaw_channels SET (claim_event_id, status) = (NEW.id, 'CS_SETTLED')
          WHERE channel_id = NEW.channel_id;
      END IF;
    
      IF NEW.event_type = 'DidStartSettling' THEN
        UPDATE chainsaw_channels SET (start_settling_event_id, status) = (NEW.id, 'CS_SETTLING')
          WHERE channel_id = NEW.channel_id;
      END IF;
    
      IF NEW.event_type = 'DidSettle' THEN
        UPDATE chainsaw_channels SET (settled_event_id, status) = (NEW.id, 'CS_SETTLED')
          WHERE channel_id = NEW.channel_id;
      END IF;
    
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    
    CREATE TRIGGER materialize_chainsaw_channel AFTER INSERT ON chainsaw_channel_events FOR EACH ROW EXECUTE PROCEDURE materialize_chainsaw_channel();
  `);
};

exports.down = function(db) {
  return null;
};

exports._meta = {
  "version": 1
};
