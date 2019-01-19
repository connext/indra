create type onchain_transaction_state as enum (
    'new',
    'submitted',
    'confirmed',
    'failed'
);

create table onchain_transactions_raw (
  id bigserial primary key,
  logical_id bigint not null,
  state onchain_transaction_state not null default 'new',

  "from" csw_eth_address not null,
  "to" csw_eth_address not null,
  value wei_amount not null,
  gas bigint not null,
  gas_price bigint not null,
  data text not null,
  nonce bigint not null,

  -- TODO: REB-61
  -- signature jsonb not null check (
  --   json_not_null(signature, 'r', 'hex') is not null and
  --   json_not_null(signature, 's', 'hex') is not null and
  --   json_not_null(signature, 'v', 'uint')::integer is not null
  -- ),
  --hash csw_sha3_hash not null unique,
  signature jsonb,
  hash csw_sha3_hash unique,

  meta jsonb not null, -- includes reason, contract, method, args, etc

  created_on timestamp with time zone not null default now(),
  submitted_on timestamp with time zone,

  confirmed_on timestamp with time zone,
  block_num integer,
  block_hash csw_sha3_hash,
  transaction_index integer,

  failed_on timestamp with time zone,
  failed_reason text
);

-- The sequence that will be used for the logical IDs
create sequence onchain_transactions_raw_logical_id_seq
start with 1;

alter sequence onchain_transactions_raw_id_seq
start with 10000000;

-- For now, enforce the constraint that there can only be one non-failed
-- onchain transaction for each logical ID. This is not, strictly speaking, true
-- because in the future we may want to implement a system which tries to submit
-- with incrementally higher gas prices... but for now this should be good.
create unique index onchain_transactions_raw_logical_id_unique
on onchain_transactions_raw (logical_id)
where (state <> 'failed');

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