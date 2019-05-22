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
    create or replace function cm_channel_updates_pre_insert_update_trigger()
    returns trigger language plpgsql as
    $pgsql$
    declare
      has_corresponding_onchain_tx boolean;
      channel cm_channels;
    begin
        -- Do not allow state updates when channel is in dispute status
        select * from cm_channels 
        where id = NEW.channel_id 
        into channel;
    
        if channel.status <> 'CS_OPEN' then
            raise exception 'cannot insert channel updates when channel is being disputed, channel = %',
            NEW;
        end if;
    
        if NEW.onchain_tx_logical_id is not null then
            has_corresponding_onchain_tx := (
                select exists((
                    select *
                    from onchain_transactions_raw
                    where logical_id = NEW.onchain_tx_logical_id
                ))
            );
    
            if not has_corresponding_onchain_tx then
                raise exception 'invalid channel update: no onchain_transactions_raw row with logical_id = % (update: %)',
                    NEW.onchain_tx_logical_id,
                    NEW;
            end if;
        end if;
    
        -- TODO: REB-36 remove this when threads are reenabled
        if NEW.thread_count <> 0 or NEW.thread_root <> '0x0000000000000000000000000000000000000000000000000000000000000000' then
            raise exception 'updates with threads are not supported yet, update: %',
            NEW;
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
