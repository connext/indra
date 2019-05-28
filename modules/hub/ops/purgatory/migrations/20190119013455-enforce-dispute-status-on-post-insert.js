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
    create or replace function cm_channel_updates_post_insert_update_trigger()
    returns trigger language plpgsql as
    $pgsql$
    declare
        latest_update cm_channel_updates;
        channel cm_channels;
        previous_channel_tx_count_global integer;
    begin
        select *
        from cm_channel_updates
        where
            channel_id = NEW.channel_id and
            invalid is null
        order by tx_count_global desc
        limit 1
        into latest_update;
    
        select tx_count_global
        from cm_channels 
        where 
            id = latest_update.channel_id
        into previous_channel_tx_count_global;
    
        update _cm_channels
        set
            hub_signed_on = latest_update.hub_signed_on,
            user_signed_on = latest_update.user_signed_on,
            latest_update_id = latest_update.id,
            last_updated_on = latest_update.created_on,
            reason = latest_update.reason,
            args = latest_update.args,
            recipient = latest_update.recipient, balance_wei_hub = latest_update.balance_wei_hub, balance_wei_user = latest_update.balance_wei_user, balance_token_hub = latest_update.balance_token_hub, balance_token_user = latest_update.balance_token_user, pending_deposit_wei_hub = latest_update.pending_deposit_wei_hub, pending_deposit_wei_user = latest_update.pending_deposit_wei_user, pending_deposit_token_hub = latest_update.pending_deposit_token_hub, pending_deposit_token_user = latest_update.pending_deposit_token_user, pending_withdrawal_wei_hub = latest_update.pending_withdrawal_wei_hub, pending_withdrawal_wei_user = latest_update.pending_withdrawal_wei_user, pending_withdrawal_token_hub = latest_update.pending_withdrawal_token_hub, pending_withdrawal_token_user = latest_update.pending_withdrawal_token_user, tx_count_global = latest_update.tx_count_global, tx_count_chain = latest_update.tx_count_chain, thread_root = latest_update.thread_root, thread_count = latest_update.thread_count, timeout = latest_update.timeout, sig_hub = latest_update.sig_hub, sig_user = latest_update.sig_user
        where id = latest_update.channel_id;
    
        if channel.status = 'CS_CHANNEL_DISPUTE' then
            -- if new state is being added, state can only be invalidation or empty channel
            if NEW.tx_count_global > previous_channel_tx_count_global then
                if NEW.reason <> 'Invalidation' and NEW.reason <> 'EmptyChannel' then
                    raise exception 'can only invalidate or empty from disputed state, NEW: %',
                    NEW;
                end if;
            end if;
        end if;
    
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
