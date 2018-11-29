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
  ALTER TABLE chainsaw_ledger_channels ADD COLUMN erc20_balance_a_chain wei_amount NOT NULL;
  ALTER TABLE chainsaw_ledger_channels ADD COLUMN erc20_balance_i_chain wei_amount NOT NULL;
  ALTER TABLE chainsaw_ledger_channels ADD COLUMN token csw_eth_address NOT NULL;
  ALTER TABLE chainsaw_ledger_channels DROP COLUMN state_hash;

  DROP TRIGGER materialize_chainsaw_ledger_channel ON chainsaw_channel_events;

  CREATE OR REPLACE FUNCTION materialize_chainsaw_ledger_channel() RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.event_type = 'DidLCOpen' THEN
        INSERT INTO chainsaw_ledger_channels (
          contract,
          channel_id,
          wei_balance_a_chain,
          wei_balance_i_chain,
          token,
          erc20_balance_a_chain,
          erc20_balance_i_chain,
          on_chain_nonce,
          vc_root_hash,
          num_open_vc,
          status,
          lc_opened_event_id
        )
          VALUES (
            NEW.contract,
            NEW.channel_id,
            CAST(NEW.fields->>'ethBalanceA' AS wei_amount),
            0,
            CAST(NEW.fields->>'token' AS csw_eth_address),
            CAST(NEW.fields->>'tokenBalanceA' AS wei_amount),
            0,
            0,
            '0x0000000000000000000000000000000000000000000000000000000000000000',
            0,
            'LCS_OPENING',
            NEW.id
          );
      END IF;

      IF NEW.event_type = 'DidLCJoin' THEN
        UPDATE chainsaw_ledger_channels SET (
          lc_joined_event_id,
          wei_balance_i_chain,
          erc20_balance_i_chain,
          status
        ) = (
          NEW.id,
          CAST(NEW.fields->>'ethBalanceI' AS wei_amount),
          CAST(NEW.fields->>'tokenBalanceI' AS wei_amount),
          'LCS_OPENED'
        )
          WHERE channel_id = NEW.channel_id;
      END IF;
      
      IF NEW.event_type = 'DidLCDeposit' THEN
        UPDATE chainsaw_ledger_channels AS clc
          SET 
            erc20_balance_a_chain = (
              CASE
                WHEN CAST(NEW.fields->>'recipient' AS csw_eth_address) = coe.sender 
                  AND CAST(NEW.fields->>'isToken' AS boolean) IS TRUE
                THEN erc20_balance_a_chain + CAST(NEW.fields->>'deposit' AS wei_amount)
                ELSE erc20_balance_a_chain
              END
            ),
            wei_balance_a_chain = (
              CASE
                WHEN CAST(NEW.fields->>'recipient' AS csw_eth_address) = coe.sender 
                  AND CAST(NEW.fields->>'isToken' AS boolean) IS NOT TRUE
                THEN wei_balance_a_chain + CAST(NEW.fields->>'deposit' AS wei_amount)
                ELSE wei_balance_a_chain
              END
            ),
            erc20_balance_i_chain = (
              CASE
                WHEN CAST(NEW.fields->>'recipient' AS csw_eth_address) = CAST(coe.fields->>'partyI' AS csw_eth_address) 
                  AND CAST(NEW.fields->>'isToken' AS boolean) IS TRUE
                THEN erc20_balance_i_chain + CAST(NEW.fields->>'deposit' AS wei_amount)
                ELSE erc20_balance_i_chain
              END
            ),
            wei_balance_i_chain = (
              CASE
                WHEN CAST(NEW.fields->>'recipient' AS csw_eth_address) = CAST(coe.fields->>'partyI' AS csw_eth_address) 
                  AND CAST(NEW.fields->>'isToken' AS boolean) IS NOT TRUE
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
            lc_start_settling_event_id,
            status,
            on_chain_nonce,
            wei_balance_a_chain,
            wei_balance_i_chain,
            erc20_balance_a_chain,
            erc20_balance_i_chain,
            vc_root_hash,
            update_timeout
          ) = (
            NEW.id,
            'LCS_SETTLING',
            CAST(NEW.fields->>'sequence' AS BIGINT),
            CAST(NEW.fields->>'ethBalanceA' AS wei_amount),
            CAST(NEW.fields->>'ethBalanceI' AS wei_amount),
            CAST(NEW.fields->>'tokenBalanceA' AS wei_amount),
            CAST(NEW.fields->>'tokenBalanceI' AS wei_amount),
            CAST(NEW.fields->>'vcRoot' AS csw_sha3_hash),
            CAST(NEW.fields->>'updateLCtimeout' AS BIGINT)
          )
        WHERE channel_id = NEW.channel_id;
      END IF;

      IF NEW.event_type = 'DidLCClose' THEN
        UPDATE chainsaw_ledger_channels 
          SET (
            lc_closed_event_id,
            status,
            on_chain_nonce,
            wei_balance_a_chain,
            wei_balance_i_chain,
            erc20_balance_a_chain,
            erc20_balance_i_chain
          ) = (
            NEW.id,
            'LCS_SETTLED',
            CAST(NEW.fields->>'sequence' AS BIGINT),
            CAST(NEW.fields->>'ethBalanceA' AS wei_amount),
            CAST(NEW.fields->>'ethBalanceI' AS wei_amount),
            CAST(NEW.fields->>'tokenBalanceA' AS wei_amount),
            CAST(NEW.fields->>'tokenBalanceI' AS wei_amount)
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
          SET (
            vc_start_settling_event_id,
            status,
            on_chain_nonce,
            challenge_timeout
          ) = (
            NEW.id,
            'VCS_SETTLING',
            CAST(NEW.fields->>'sequence' AS BIGINT),
            CAST(NEW.fields->>'updateVCtimeout' AS BIGINT)
          )
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
