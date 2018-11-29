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
    ALTER TABLE chainsaw_ledger_channels
    ADD COLUMN open_timeout BIGINT;

    ALTER TABLE virtual_channels
    RENAME COLUMN challenge_timeout TO update_timeout;

    DROP TRIGGER materialize_chainsaw_ledger_channel ON chainsaw_channel_events;

    CREATE OR REPLACE FUNCTION materialize_chainsaw_ledger_channel() RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.event_type = 'DidLCOpen' THEN
        INSERT INTO chainsaw_ledger_channels (
          contract,
          channel_id,
          wei_balance_a_chain,
          wei_balance_i_chain,
          on_chain_nonce,
          state_hash,
          vc_root_hash,
          num_open_vc,
          open_timeout,
          status,
          lc_opened_event_id
        )
          VALUES (
            NEW.contract,
            NEW.channel_id,
            CAST(NEW.fields->>'balanceA' AS wei_amount),
            0,
            0,
            '0x0000000000000000000000000000000000000000000000000000000000000000',
            '0x0000000000000000000000000000000000000000000000000000000000000000',
            0,
            CAST(NEW.fields->>'LCopenTimeout' AS BIGINT),
            'LCS_OPENING',
            NEW.id
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
          SET (vc_start_settling_event_id, status, on_chain_nonce, update_timeout) = (NEW.id, 'VCS_SETTLING', CAST(NEW.fields->>'sequence' AS BIGINT), CAST(NEW.fields->>'updateVCtimeout' AS BIGINT))
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

    CREATE OR REPLACE VIEW hub_ledger_channels AS
      WITH lcs AS (
        SELECT
          csw.id                                                  id,
          csw.contract                                            contract,
          csw.channel_id                                          channel_id,
          coe.sender                                              party_a,
          CAST(coe.fields ->> 'partyI' AS csw_eth_address)        party_i,
          COALESCE(lcsu.wei_balance_a, csw.wei_balance_a_chain)   wei_balance_a,
          COALESCE(lcsu.wei_balance_i, csw.wei_balance_i_chain)   wei_balance_i,
          csw.wei_balance_a_chain                                 wei_balance_a_chain,
          csw.wei_balance_i_chain                                 wei_balance_i_chain,
          COALESCE(lcsu.nonce, 0)                                 nonce,
          COALESCE(lcsu.open_vcs, 0)                              open_vcs,
          COALESCE(lcsu.vc_root_hash, csw.vc_root_hash)           vc_root_hash,
          csw.status                                              status,
          csw.lc_opened_event_id                                  lc_opened_event_id,
          csw.lc_joined_event_id                                  lc_joined_event_id,
          csw.lc_start_settling_event_id                          lc_start_settling_event_id,
          csw.lc_closed_event_id                                  lc_closed_event_id,
          csw.open_timeout                                        open_timeout,
          csw.update_timeout                                      update_timeout
        FROM chainsaw_ledger_channels csw
          LEFT OUTER JOIN chainsaw_channel_events coe ON coe.id = csw.lc_opened_event_id
          LEFT OUTER JOIN ledger_channel_state_updates lcsu ON lcsu.channel_id = csw.channel_id
        )

        SELECT t1.* FROM lcs t1
        LEFT JOIN lcs t2
        ON t1.id = t2.id AND t1.nonce < t2.nonce
        WHERE t2.nonce IS NULL
        ORDER BY t1.nonce DESC;

    CREATE OR REPLACE VIEW hub_virtual_channels AS                                                                                                                                                                      
      WITH vcs AS (                                                                                                                                                                                                          
        SELECT                                                                                                                                                                                                                 
          vc.id                                   id,                                                                                                                                                                           
          vc.channel_id                           channel_id,                                                                                                                                                                   
          vc.party_a                              party_a,                                                                                                                                                                      
          vc.party_b                              party_b,                                                                                                                                                                      
          vc.party_i                              party_i,                                                                                                                                                                      
          vc.subchan_a_to_i                       subchan_a_to_i,                                                                                                                                                               
          vc.subchan_b_to_i                       subchan_b_to_i,                                                                                                                                                               
          COALESCE(vcsu.wei_balance_a, 0)         wei_balance_a,                                                                                                                                                                    
          COALESCE(vcsu.wei_balance_b, 0)         wei_balance_b,                                                                                                                                                                    
          COALESCE(vcsu.nonce, 0)                 nonce,                                                                                                                                                                            
          vc.status                               status,
          vc.update_timeout                       update_timeout
        FROM virtual_channels vc                                                                                                                                                                                                    
        JOIN virtual_channel_state_updates vcsu ON vcsu.channel_id = vc.channel_id                                                                                                                                              
      )    

      SELECT t1.* FROM vcs t1
      LEFT JOIN vcs t2
      ON t1.id = t2.id AND t1.nonce < t2.nonce
      WHERE t2.nonce IS NULL
      ORDER BY t1.nonce DESC;
  `)
}

exports.down = function(db) {
  return null
}

exports._meta = {
  version: 1,
}
