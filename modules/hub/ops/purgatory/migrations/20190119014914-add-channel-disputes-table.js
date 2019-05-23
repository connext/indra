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
    create type channel_dispute_status as enum (
        'CD_PENDING',
        'CD_IN_DISPUTE_PERIOD',
        'CD_FAILED',
        'CD_FINISHED'
    );

    create table _cm_channel_disputes (
        id bigserial primary key,
        channel_id bigint references _cm_channels(id) not null,
        status channel_dispute_status not null default 'CD_PENDING',

        started_on timestamp with time zone not null, 
        reason text not null, 

        onchain_tx_id_start bigint null, -- references onchain_transactions_raw(logical_id) and checked by trigger
        onchain_tx_id_empty bigint null, -- references onchain_transactions_raw(logical_id) and checked by trigger
        start_event_id bigint references chainsaw_events(id) null, -- startExit{WithUpdate} event
        empty_event_id bigint references chainsaw_events(id) null, -- emptyChannel{WithUpdate}

        dispute_period_ends bigint null, -- in seconds, corresponds to block time
        originator csw_eth_address null
    );

    create or replace function channel_disputes_check_insert_update_trigger()
    returns trigger language plpgsql as
    $pgsql$
    declare
      has_corresponding_onchain_tx boolean;
    begin
        -- Check unilateral start exit and change status
        if NEW.onchain_tx_id_start is not null then
            has_corresponding_onchain_tx := (
                select exists((
                    select *
                    from onchain_transactions_raw
                    where logical_id = NEW.onchain_tx_id_start
                ))
            );

            if not has_corresponding_onchain_tx then
                raise exception 'invalid channel dispute: no onchain_transactions_raw row with logical_id = % (update: %)',
                    NEW.onchain_tx_id_start,
                    NEW;
            end if;
        end if;

        if NEW.onchain_tx_id_empty is not null then
            has_corresponding_onchain_tx := (
                select exists((
                    select *
                    from onchain_transactions_raw
                    where logical_id = NEW.onchain_tx_id_empty
                ))
            );

            if not has_corresponding_onchain_tx then
                raise exception 'invalid channel dispute: no onchain_transactions_raw row with logical_id = % (update: %)',
                    NEW.onchain_tx_id_empty,
                    NEW;
            end if;
        end if;
        
        return NEW;
    end;
    $pgsql$;

    create trigger channel_disputes_check_insert_update_trigger
    before insert or update on _cm_channel_disputes
    for each row execute procedure channel_disputes_check_insert_update_trigger();

    alter table _cm_channels
    add constraint channel_dispute_id_fk
    foreign key (channel_dispute_id)
    references _cm_channel_disputes(id);

    create or replace function channel_disputes_check_post_insert_trigger()
    returns trigger language plpgsql as
    $pgsql$
    declare
        dispute_count integer;
    begin
        select count(id) 
        from _cm_channel_disputes 
        where 
            channel_id = NEW.channel_id and
            status in ('CD_PENDING', 'CD_IN_DISPUTE_PERIOD')
        into dispute_count;

        if dispute_count > 1 then
            raise exception 'channel has more than 1 active dispute records, channel: % (NEW: %)',
            (select * from cm_channels where id = NEW.channel_id),
            NEW;
        end if;

        -- Set or unset value in _cm_channels table
        if NEW.status in ('CD_PENDING', 'CD_IN_DISPUTE_PERIOD') then
            update _cm_channels
            set channel_dispute_id = NEW.id
            where _cm_channels.id = NEW.channel_id;
        else
            -- status in ('CD_FAILED', 'CD_FINISHED')
            update _cm_channels
            set channel_dispute_id = null
            where _cm_channels.id = NEW.channel_id;
        end if;

        return NEW;
    end;
    $pgsql$;

    create trigger channel_disputes_check_post_insert_trigger
    after insert or update on _cm_channel_disputes
    for each row execute procedure channel_disputes_check_post_insert_trigger();

    create view cm_channel_disputes as (
        select *
        from _cm_channel_disputes
        -- TODO: fix below!
        -- inner join cm_channels on cm_channels.id = _cm_channel_disputes.channel_id
    );
  `);
};

exports.down = function(db) {
  return null;
};

exports._meta = {
  "version": 1
};
