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
    create or replace function cm_channels_check_update_trigger()
    returns trigger language plpgsql as
    $pgsql$
    declare
      dispute_id bigint;
    begin
        -- Check unilateral start exit and change status
    
        dispute_id := (
            select id from cm_channel_disputes
            where 
                channel_id = NEW.id and
                status in ('CD_PENDING', 'CD_IN_DISPUTE_PERIOD')
        );
    
        if NEW.channel_dispute_id is not null then
            NEW.status := 'CS_CHANNEL_DISPUTE';
    
            if (dispute_id) is null then
                raise exception 'Channel has invalid channel dispute status, dispute status: % (NEW: %)',
                (select status from cm_channel_disputes where id = NEW.channel_dispute_id),
                NEW;
            end if;
        else
            NEW.status := 'CS_OPEN';
    
            if (dispute_id) is not null then
                raise exception 'Channel has invalid channel dispute status, dispute status: % (NEW: %)',
                (select status from cm_channel_disputes where id = NEW.channel_dispute_id),
                NEW;
            end if;
        end if;
    
        -- Check that the dispute status is reasonable
        if not (
            coalesce(
                NEW.channel_dispute_id::text,
                NEW.thread_dispute_event_id::text,
                NEW.thread_dispute_ends_on::text,
                NEW.thread_dispute_originator::text
            ) is null or
    
            (
                NEW.channel_dispute_id is not null
            ) or
    
            (
                NEW.thread_dispute_event_id is not null and
                NEW.thread_dispute_ends_on is not null and
                NEW.thread_dispute_originator is not null
            )
        ) then
            raise exception 'Channel has invalid channel/thread dispute status: %', NEW;
        end if;
    
        /*
        TODO: these don't handle deposits.
        Add them to checks on insert to _cm_channel_updates
    
        -- Check that total balance is preserved if we aren't opening a thread
        if (
            OLD.thread_count = NEW.thread_count AND
            (OLD.balance_wei_hub + OLD.balance_wei_user <> NEW.balance_wei_hub + NEW.balance_wei_user)
        ) then
            raise exception 'Update changes total channel wei balance (old: [%, %], new: [%, %])',
                OLD.balance_wei_hub / 1e18,
                OLD.balance_wei_user / 1e18,
                NEW.balance_wei_hub / 1e18,
                NEW.balance_wei_user / 1e18;
        end if;
    
        if (
            OLD.thread_count = NEW.thread_count AND
            (OLD.balance_token_hub + OLD.balance_token_user <> NEW.balance_token_hub + NEW.balance_token_user)
        ) then
            raise exception 'Update changes total channel token balance (old: [%, %], new: [%, %])',
                OLD.balance_token_hub / 1e18,
                OLD.balance_token_user / 1e18,
                NEW.balance_token_hub / 1e18,
                NEW.balance_token_user / 1e18;
        end if;
        */
    
        -- TODO: Check if OLD.thread_count = NEW.thread_count + 1
        -- OLD.balance_wei_hub + OLD.balance_wei_user == NEW.balance_wei_hub + NEW.balance_wei_user - (NEW.thread_balance_sender + NEW.thread_balance_receiver)
    
        -- TODO: Check if OLD.thread_count = NEW.thread_count - 1
        -- OLD.balance_wei_hub + OLD.balance_wei_user == NEW.balance_wei_hub + NEW.balance_wei_user + NEW.thread_balance_sender + NEW.thread_balance_receiver
    
        -- Check that the tx count increases monotonically
        if (
            NEW.tx_count_global < OLD.tx_count_global
            -- do not check tx_count_chain since invalidation updates can potentially lower it
        ) then
            raise exception 'Update lowers channel tx_count (old: [%, %], new: [%, %])',
                OLD.tx_count_global,
                OLD.tx_count_chain,
                NEW.tx_count_global,
                NEW.tx_count_chain;
        end if;
    
        -- TODO: Probably more checks
        return NEW;
    
    end;
    $pgsql$;
  `);
};

exports.down = function(db) {
  return null;
};

exports._meta = {
  "version": 1
};
