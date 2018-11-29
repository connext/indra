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
  // TODO finish adding events
  return db.runSql(`
    CREATE TYPE csw_ledger_channel_state as enum (
      'LCS_OPENING',  -- Channel opened, waiting for participant to join
      'LCS_OPENED',   -- Open for business
      'LCS_SETTLING', -- Sender has requested settlement
      'LCS_SETTLED'   -- Channel has been settled
    );
  
    CREATE TABLE chainsaw_ledger_channels (
      id                      BIGSERIAL PRIMARY KEY,
      contract                csw_eth_address           NOT NULL,
      channel_id              csw_sha3_hash             NOT NULL UNIQUE,
      wei_balance_a_chain     wei_amount                NOT NULL,
      wei_balance_i_chain     wei_amount                NOT NULL,
      on_chain_nonce          BIGINT                    NOT NULL,
      state_hash              csw_sha3_hash             NOT NULL,
      vc_root_hash            csw_sha3_hash             NOT NULL,
      num_open_vc             BIGINT                    NOT NULL,
      status                  csw_ledger_channel_state  NOT NULL,
      update_timeout          BIGINT,
    
      lc_opened_event_id          BIGINT REFERENCES chainsaw_channel_events (id),
      lc_joined_event_id          BIGINT REFERENCES chainsaw_channel_events (id),
      lc_start_settling_event_id  BIGINT REFERENCES chainsaw_channel_events (id),
      lc_closed_event_id          BIGINT REFERENCES chainsaw_channel_events (id)
    );
    
    CREATE TABLE chainsaw_ledger_channels_deposits (
      channel_id csw_sha3_hash REFERENCES chainsaw_ledger_channels(channel_id),
      deposit_event_id BIGINT  REFERENCES chainsaw_channel_events(id)
    );
    
    CREATE OR REPLACE FUNCTION materialize_chainsaw_ledger_channel() RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.event_type = 'DidLCOpen' THEN
        INSERT INTO chainsaw_ledger_channels (
          contract, channel_id, wei_balance_a_chain, wei_balance_i_chain, on_chain_nonce, state_hash, vc_root_hash, num_open_vc, status, lc_opened_event_id
        )
          VALUES (
            NEW.contract, NEW.channel_id, CAST(NEW.fields->>'balanceA' AS wei_amount), 0, 0, '0x0000000000000000000000000000000000000000000000000000000000000000', '0x0000000000000000000000000000000000000000000000000000000000000000', 0, 'LCS_OPENING', NEW.id
          );
      END IF;

      IF NEW.event_type = 'DidLCJoin' THEN
        UPDATE chainsaw_ledger_channels SET (
          lc_joined_event_id, wei_balance_i_chain, status
        ) = (
          NEW.id, CAST(NEW.fields->>'balanceI' AS wei_amount), 'LCS_OPENED'
        )
          WHERE channel_id = NEW.channel_id;
      END IF;
      
      IF NEW.event_type = 'DidLCDeposit' THEN
        UPDATE chainsaw_ledger_channels AS clc
        SET 
        wei_balance_a_chain = (
            CASE
              WHEN CAST(NEW.fields->>'recipient' AS csw_eth_address) = coe.sender
              THEN wei_balance_a_chain + CAST(NEW.fields->>'deposit' AS wei_amount)
              ELSE wei_balance_a_chain
            END
          ),
          wei_balance_i_chain = (
            CASE
              WHEN CAST(NEW.fields->>'recipient' AS csw_eth_address) = CAST(coe.fields->>'partyI' AS csw_eth_address)
              THEN wei_balance_i_chain + CAST(NEW.fields->>'deposit' AS wei_amount)
              ELSE wei_balance_i_chain
            END
          )
        FROM chainsaw_channel_events AS coe
        WHERE clc.channel_id = NEW.channel_id AND coe.id = clc.lc_opened_event_id;

        INSERT INTO chainsaw_ledger_channels_deposits (channel_id, deposit_event_id)
          VALUES (NEW.channel_id, NEW.id);
      END IF;

      IF NEW.event_type = 'DidLCUpdateState' THEN
        UPDATE chainsaw_ledger_channels 
          SET (
            lc_start_settling_event_id, status, on_chain_nonce, wei_balance_a_chain, wei_balance_i_chain, update_timeout
          ) = (
            NEW.id, 'LCS_SETTLING', CAST(NEW.fields->>'sequence' AS BIGINT), CAST(NEW.fields->>'balanceA' AS wei_amount), CAST(NEW.fields->>'balanceI' AS wei_amount), CAST(NEW.fields->>'updateLCtimeout' AS BIGINT)
          )
        WHERE channel_id = NEW.channel_id;
      END IF;

      IF NEW.event_type = 'DidLCClose' THEN
        UPDATE chainsaw_ledger_channels 
          SET (
            lc_closed_event_id, status, on_chain_nonce, wei_balance_a_chain, wei_balance_i_chain
          ) = (
            NEW.id, 'LCS_SETTLED', CAST(NEW.fields->>'sequence' AS BIGINT), CAST(NEW.fields->>'balanceA' AS wei_amount), CAST(NEW.fields->>'balanceI' AS wei_amount)
          )
        WHERE channel_id = NEW.channel_id;
      END IF;

      IF NEW.event_type = 'DidVCInit' THEN
        UPDATE virtual_channels 
          SET (vc_init_event_id, status, on_chain_nonce) = (NEW.id, 'VCS_OPENED', CAST(NEW.fields->>'sequence' AS BIGINT))
        WHERE channel_id = NEW.channel_id;
      END IF;

      IF NEW.event_type = 'DidVCSettle' THEN
        UPDATE virtual_channels 
          SET (vc_start_settling_event_id, status, on_chain_nonce, challenge_timeout) = (NEW.id, 'VCS_SETTLING', CAST(NEW.fields->>'sequence' AS BIGINT), CAST(NEW.fields->>'updateVCtimeout' AS BIGINT))
        WHERE channel_id = NEW.channel_id;
      END IF;

      IF NEW.event_type = 'DidVCClose' THEN
        UPDATE virtual_channels 
          SET (vc_settled_event_id, status) = (NEW.id, 'VCS_SETTLED')
        WHERE channel_id = NEW.channel_id;
      END IF;
    
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    
    CREATE TRIGGER materialize_chainsaw_ledger_channel AFTER INSERT ON chainsaw_channel_events FOR EACH ROW EXECUTE PROCEDURE materialize_chainsaw_ledger_channel();
  `)
}

exports.down = function(db) {
  return null
}

exports._meta = {
  version: 1,
}
