<%
function camelCase(str) {
  return str.replace(/_\w/g, function(m) {
    return m[1].toUpperCase();
  });
}

function makeColumns(cols) {
  return cols.map(col => {
    col.jsonName = col.jsonName || camelCase(col.name)
    col.sqlType = col.sql.replace(/^\s*/, '').split(' ')[0]
    col.nullable = !/not null/.exec(col.sql)
    col.jsonCastStr = col.jsonCast ? '::' + col.jsonCast : ''
    return col
  })
}

const SQL_TO_INPUT_TYPES = {
  'csw_sha3_hash': 'hex',
  'csw_eth_address': 'hex',
  'eth_signature': 'hex',
  'token_amount': 'uint256',
  'wei_amount': 'uint256',
  'integer': 'uint',
}

/*
 * Gets a column from a JSON object.
 * > colGetFromJson('update_obj', { name: 'sig_hub', sql: 'eth_signature not null' })
 * "json_not_null(update_obj, 'sigHub', 'hex')::csw_eth_address"
 */
function colGetFromJson(objName, col) {
  let func = col.nullable ? 'json_null' : 'json_not_null'
  let inputType = SQL_TO_INPUT_TYPES[col.sqlType]
  if (!inputType)
    throw new Error(`Unknown input type for ${col.name}: ${col.sqlType} (hint: add it to SQL_TO_INPUT_TYPES)`)
  return `${func}(${objName}, '${col.jsonName}', '${inputType}')::${col.sqlType}`
}


const CHANNEL_STATE_COLS = makeColumns([
  { name: 'recipient', sql: 'csw_eth_address not null' },

  { name: 'balance_wei_hub', sql: 'wei_amount not null', jsonCast: 'text' },
  { name: 'balance_wei_user', sql: 'wei_amount not null', jsonCast: 'text' },

  { name: 'balance_token_hub', sql: 'token_amount not null', jsonCast: 'text' },
  { name: 'balance_token_user', sql: 'token_amount not null', jsonCast: 'text' },

  { name: 'pending_deposit_wei_hub', sql: 'wei_amount', jsonCast: 'text' },
  { name: 'pending_deposit_wei_user', sql: 'wei_amount', jsonCast: 'text' },

  { name: 'pending_deposit_token_hub', sql: 'token_amount', jsonCast: 'text' },
  { name: 'pending_deposit_token_user', sql: 'token_amount', jsonCast: 'text' },

  { name: 'pending_withdrawal_wei_hub', sql: 'wei_amount', jsonCast: 'text' },
  { name: 'pending_withdrawal_wei_user', sql: 'wei_amount', jsonCast: 'text' },

  { name: 'pending_withdrawal_token_hub', sql: 'token_amount', jsonCast: 'text' },
  { name: 'pending_withdrawal_token_user', sql: 'token_amount', jsonCast: 'text' },

  { name: 'tx_count_global', sql: 'integer not null' },
  { name: 'tx_count_chain', sql: 'integer not null' },

  { name: 'thread_root', sql: `
    csw_sha3_hash null check (case
        when thread_root ~ '^0x0+$' then thread_count = 0
        else thread_count > 0
    end)
  `},

  { name: 'thread_count', sql: 'integer not null check (thread_count >= 0)' },

  { name: 'timeout', sql: 'integer null' },

  { name: 'sig_hub', sql: 'eth_signature not null' },
  { name: 'sig_user', sql: 'eth_signature null' },
])

const THREAD_STATE_COLS = makeColumns([
  { name: 'thread_id', sql: 'integer not null' },
  { name: 'tx_count', sql: 'integer not null' },

  { name: 'balance_wei_sender', sql: 'wei_amount not null' },
  { name: 'balance_wei_receiver', sql: 'wei_amount not null' },

  { name: 'balance_token_sender', sql: 'token_amount not null' },
  { name: 'balance_token_receiver', sql: 'token_amount not null' },

  { name: 'sig_a', sql: 'eth_signature not null' },
])

%>

/*
To be enforced by DB:
- global validity of channel updates
- cm_{channels,threads} can only be updated by inserts to cm_{channel,thread}_updates
    - possibly with stored procedure
- Can't update cm_*_updates
*/

--
-- Chainsaw
--

create type cm_event_type as enum (
    'DidHubContractWithdraw',
    'DidUpdateChannel',
    'DidStartExitChannel',
    'DidEmptyChannel',
    'DidStartExitThread',
    'DidEmptyThread',
    'DidNukeThread'
);

create table chainsaw_events (
    id bigserial primary key,
    contract csw_eth_address not null,
    ts timestamp with time zone not null,

    block_number integer not null,
    block_hash csw_sha3_hash not null,
    tx_hash csw_sha3_hash not null,
    tx_index integer not null,
    log_index integer not null,

    sender csw_eth_address not null,

    -- references _cm_channels(id) is added later
    -- note: nullable because of the DidHubContractWithdraw event
    channel_id bigint,
    event_type cm_event_type not null,
    fields jsonb not null
);

-- No two chainsaw events should ever have the same (tx_hash, log_index)
create unique index chainsaw_events_tx_hash_log_index
on chainsaw_events (tx_hash, log_index);

--
-- cm_channels
--

create type cm_channel_status as enum (
    'CS_OPEN',
    'CS_CHANNEL_DISPUTE',
    'CS_THREAD_DISPUTE'
);

create type cm_channel_update_reason as enum (
    'Payment',
    'Exchange',
    'ProposePendingDeposit',
    'ProposePendingWithdrawal',
    'ConfirmPending',
    'OpenThread',
    'CloseThread'
);

-- Note: _cm_channels has the underscore prefix because it is never meant to be
-- queried directly. Instead, the `cm_channels` view should be used. This is to
-- prevent people from trying to insert or update on it directly.
create table _cm_channels (
    id bigserial primary key,
    contract csw_eth_address not null,
    hub csw_eth_address not null,
    "user" csw_eth_address not null,
    status cm_channel_status not null check (
        case status
        when 'CS_OPEN' then
            coalesce(channel_dispute_event_id, thread_dispute_event_id) is null
        when 'CS_CHANNEL_DISPUTE' then 
            channel_dispute_event_id is not null and
            thread_dispute_event_id is null
        when 'CS_THREAD_DISPUTE' then
            channel_dispute_event_id is null and
            thread_dispute_event_id is not null
        end
    ) default 'CS_OPEN',

    hub_signed_on timestamp with time zone null,
    user_signed_on timestamp with time zone null,

    reason cm_channel_update_reason null,
    args jsonb null,

    <%= CHANNEL_STATE_COLS.map(c => {
      // We need to allow these columns to be null so that the channel can
      // created. They will be updated by the subsequent state update.
      // insert/update trigger.
      c = { ...c, sql: c.sql.replace('not null', 'null') }
      return `${c.name} ${c.sql}`
    }).join(', ') %>,

    latest_update_id bigint, -- references _cm_channel_updates(id) deferrable initially deferred,
    last_updated_on timestamp with time zone null,

    channel_dispute_event_id bigint references chainsaw_events(id) null,
    channel_dispute_ends_on timestamp with time zone null,
    channel_dispute_originator csw_eth_address null,

    thread_dispute_event_id bigint references chainsaw_events(id) null,
    thread_dispute_ends_on timestamp with time zone null,
    thread_dispute_originator csw_eth_address null
);

create view cm_channels as (select * from _cm_channels);

create unique index cm_channels_contract_user
on _cm_channels (contract, "user");

alter table chainsaw_events
add constraint channel_id_fk foreign key (channel_id)
references _cm_channels(id);


create or replace function cm_channels_check_update_trigger()
returns trigger language plpgsql as
$pgsql$
begin
    -- Check that the dispute status is reasonable
    if not (
        coalesce(
            NEW.channel_dispute_event_id::text,
            NEW.channel_dispute_ends_on::text,
            NEW.channel_dispute_originator::text,
            NEW.thread_dispute_event_id::text,
            NEW.thread_dispute_ends_on::text,
            NEW.thread_dispute_originator::text
        ) is null or

        (
            NEW.channel_dispute_event_id is not null and
            NEW.channel_dispute_ends_on is not null and
            NEW.channel_dispute_originator is not null
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
        NEW.tx_count_global < OLD.tx_count_global OR
        NEW.tx_count_chain < OLD.tx_count_chain
    ) then
        raise exception 'Update lowers channel tx_count (old: [%, %], new: [%, %])',
            NEW.tx_count_global,
            OLD.tx_count_global,
            NEW.tx_count_chain,
            OLD.tx_count_chain;
    end if;

    -- TODO: Probably more checks
    return NEW;

end;
$pgsql$ ;

create trigger cm_channels_check_update_trigger
before update on _cm_channels
for each row execute procedure cm_channels_check_update_trigger();

--
-- cm_channel_updates
--

create type cm_channel_update_invalid_reason as enum (
    'CU_INVALID_EXPIRED'
);

-- Note: _cm_channel_updates has the underscore prefix because it is never meant to be
-- queried directly. Instead, the `cm_channel_updates` view should be used. This is to
-- prevent people from trying to insert or update on it directly.
create table _cm_channel_updates (
    id bigserial primary key,
    channel_id bigint references _cm_channels(id),
    created_on timestamp with time zone not null default now(),
    reason cm_channel_update_reason not null,
    args jsonb not null,
    originator csw_eth_address not null,

    -- TODO: needed to add this to have user accessible in channel updates
    "user" csw_eth_address not null,

    -- Usually the hub will sign updates before they are put into the database,
    -- except in the case of hub-proposed exchanges, where hub will insert an
    -- un-signed update that will be sync'd to the wallet, which the wallet
    -- will sign and send back.
    -- Note: this also implies that the "sync()" mechanism can only send state
    -- updates. Potentially a better way to do this will be to allow more
    -- general messages to be sync'd?
    invalid cm_channel_update_invalid_reason null,

    hub_signed_on timestamp with time zone not null,
    user_signed_on timestamp with time zone null check (case when sig_user is null then user_signed_on is null else user_signed_on is not null end),

    <%= CHANNEL_STATE_COLS.map(c => `${c.name} ${c.sql}`).join(', ') %>,

    -- The ID of the chainsaw event which caused this update
    chainsaw_event_id bigint references chainsaw_events(id) null,

    -- The ID of the chainsaw event which resolved this pending update (ie,
    -- if this update introduces pending values, this will be the ID of the
    -- chainsaw event which confirms those values).
    chainsaw_resolution_event_id bigint references chainsaw_events(id) null,

    -- The ID of the onchain transaction corresponding to this update
    onchain_tx_logical_id bigint null -- references onchain_transactions_raw(logical_id) and checked by trigger
);

create view cm_channel_updates as (
    select
        cu.*,
        c.contract
    from _cm_channel_updates as cu
    inner join cm_channels as c on c.id = cu.channel_id
);

create unique index cm_channel_updates_channel_txcount_unique
on _cm_channel_updates (channel_id, tx_count_global)
where (invalid is null);

alter table _cm_channels
add constraint latest_update_id_fk
foreign key (latest_update_id)
references _cm_channel_updates(id) deferrable initially deferred;


create function cm_channel_insert_or_update_state(
    _hub csw_eth_address,
    _contract csw_eth_address,
    _user csw_eth_address,

    reason cm_channel_update_reason,
    args jsonb,
    originator csw_eth_address,

    _chainsaw_event_id bigint,
    _onchain_tx_logical_id bigint,

    update_obj jsonb -- matching the SignedChannelupdate interface
)
returns cm_channel_updates
language plpgsql as $pgsql$
declare
    channel cm_channels;
    update_row _cm_channel_updates;
    _sig_hub eth_signature := json_not_null(update_obj, 'sigHub', 'hex');
    _sig_user eth_signature := json_null(update_obj, 'sigUser', 'hex');
begin
    -- Note: assume that the channel already exists. This should be safe
    -- because there shouldn't be any update updates except as the result of
    -- a chainsaw event, which will create the channel.
    -- In theory, though, this restriction could be lifted and this function
    -- could accept the (contract, hub, user) and create the channel.

    channel := (
        select row(c.*)
        from cm_channels as c
        where
            contract = _contract and
            "user" = _user
    );

    if channel.id is null then
        if (update_obj->>'txCountGlobal') is distinct from '1' then
            raise exception 'Refusing to create channel (%, %) in response to state (%) when txCountGlobal <> 1',
                _contract,
                _user,
                update_obj;
        end if;

        insert into _cm_channels (contract, hub, "user", recipient)
        values (_contract, _hub, _user, _user)
        returning * into channel;
    end if;

    update_row := (
      select row(u.*)
      from _cm_channel_updates as u
      where
        channel_id = channel.id and
        tx_count_global = json_not_null(update_obj, 'txCountGlobal', 'uint256')::bigint
    );

    if update_row.id is not null then

      if _sig_user is not null and _sig_user is distinct from update_row.sig_user then
        if update_row.sig_user is not null then
          raise exception 'update attempts to change signature on update % from % to %!',
            update_row.id, update_row.sig_user, _sig_user;
        end if;

        update _cm_channel_updates
        set
          sig_user = _sig_user,
          user_signed_on = now()
        where id = update_row.id;
      end if;

      update_row := (select row(u.*) from _cm_channel_updates as u where id = update_row.id);

    else

      insert into _cm_channel_updates (
          channel_id, reason, args, originator,

          "user",

          hub_signed_on, user_signed_on,

          chainsaw_event_id, onchain_tx_logical_id,

          <%= CHANNEL_STATE_COLS.map(c => c.name).join(', ') %>
      ) values (
          channel.id, reason, args, originator,

          _user,

          now(),
          case when _sig_user is null then null else now() end,

          _chainsaw_event_id, _onchain_tx_logical_id,

          <%= CHANNEL_STATE_COLS.map(c => colGetFromJson('update_obj', c)).join(', ') %>
      ) returning * into update_row;

      -- TODO: This is wrong! Make it not wrong.
      -- update _cm_channel_updates
      -- set chainsaw_resolution_event_id = _chainsaw_event_id
      -- where id = (
      --   select id from _cm_channel_updates u
      --   where u.channel_id = _channel_id and u.reason = 'ProposePending'
      --   order by tx_count_global
      --   limit 1
      -- );

    end if;

    return (
        select row(up.*)::cm_channel_updates
        from cm_channel_updates as up
        where id = update_row.id
    );
end
$pgsql$;

create or replace function cm_channel_updates_pre_insert_update_trigger()
returns trigger language plpgsql as
$pgsql$
declare
  has_corresponding_onchain_tx boolean;
begin

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

create trigger cm_channel_updates_pre_insert_update_trigger
before insert or update on _cm_channel_updates
for each row execute procedure cm_channel_updates_pre_insert_update_trigger();

create or replace function cm_channel_updates_post_insert_update_trigger()
returns trigger language plpgsql as
$pgsql$
declare
    latest_update cm_channel_updates;
begin
    select *
    from cm_channel_updates
    where
        channel_id = NEW.channel_id and
        invalid is null
    order by tx_count_global desc
    limit 1
    into latest_update;

    update _cm_channels
    set
        hub_signed_on = latest_update.hub_signed_on,
        user_signed_on = latest_update.user_signed_on,
        latest_update_id = latest_update.id,
        last_updated_on = latest_update.created_on,
        reason = latest_update.reason,
        args = latest_update.args,
        <%= CHANNEL_STATE_COLS.map(c => `${c.name} = latest_update.${c.name}`).join(', ') %>
    where id = latest_update.channel_id;

    return NEW;
end;
$pgsql$;

create trigger cm_channel_updates_post_insert_update_trigger
after insert or update on _cm_channel_updates
for each row execute procedure cm_channel_updates_post_insert_update_trigger();


--
-- cm_threads
--

create type cm_thread_status as enum (
    'CT_CLOSED',
    'CT_OPEN',
    'CT_IN_DISPUTE'
);

create table _cm_threads (
    id bigserial primary key,

    sender csw_eth_address not null check (sender <> receiver),
    receiver csw_eth_address not null check (sender <> receiver),

    sender_channel_id bigint references _cm_channels(id) not null,
    receiver_channel_id bigint references _cm_channels(id) not null,

    status cm_thread_status not null check (
        case status
        when 'CT_OPEN' then
            coalesce(sender_dispute_event_id, receiver_dispute_event_id) is null
        when 'CT_IN_DISPUTE' then 
            coalesce(sender_dispute_event_id, receiver_dispute_event_id) is not null
        end
    ) default 'CT_CLOSED',

    <%= THREAD_STATE_COLS.map(c => {
      // We need to allow these columns to be null so that the channel can
      // created. They will be updated by the subsequent state update.
      // insert/update trigger.
      c = { ...c, sql: c.sql.replace('not null', 'null') }
      return `${c.name} ${c.sql}`
    }).join(', ') %>,

    latest_update_id bigint null, -- references _cm_thread_updates(id)
    last_updated_on timestamp with time zone null,

    sender_open_update_id bigint references _cm_channel_updates(id) null,
    receiver_open_update_id bigint references _cm_channel_updates(id) null,

    sender_close_update_id bigint references _cm_channel_updates(id) null,
    receiver_close_update_id bigint references _cm_channel_updates(id) null,

    sender_dispute_event_id bigint references chainsaw_events(id) null,
    sender_dispute_ends_on timestamp with time zone null,

    receiver_dispute_event_id bigint references chainsaw_events(id) null,
    receiver_dispute_ends_on timestamp with time zone null
);

-- Note: to help avoid potential bugs from queries which incorrectly use:
--   join cm_threads on cm_threads.id = cm_thread_updates.thread_id
-- Instead of:
--   join cm_threads on cm_threads.id = cm_thread_updates.thread_pk
-- Start the cm_threads.id sequence at 1,000,000 so it's very unlikely that
-- there will ever be a situation where a `cm_thread_updates.thread_id` will
-- also be a valid `cm_threads.id`.
alter sequence _cm_threads_id_seq
start with 1000000;

create view cm_threads as (
    select
        t.*,
        c.contract
    from _cm_threads as t
    inner join cm_channels as c on c.id = t.sender_channel_id
);

create unique index cm_threads_sender_receiver
on _cm_threads (sender_channel_id, receiver_channel_id)
where (status <> 'CT_CLOSED');

-- TODO:
-- - constraint to check that a thread is opened each time an OpenThread state is inserted
-- - same for CloseThread
-- - check that the contract for (sender_channel_id, receiver_channel_id) matches

create index cm_threads_sender
on _cm_threads (sender);

create index cm_threads_receiver
on _cm_threads (receiver);

create or replace function cm_threads_check_update_trigger()
returns trigger language plpgsql as
$pgsql$
begin
    -- Check that the dispute status is reasonable
    if (
        coalesce(
            NEW.sender_dispute_event_id::text,
            NEW.receiver_dispute_event_id::text
        ) is not null
    ) then
        raise exception 'Channel has invalid channel/thread dispute status: %', NEW;
    end if;

    -- Check that total balance is preserved
    if OLD.balance_wei_sender + OLD.balance_wei_receiver <> NEW.balance_wei_sender + NEW.balance_wei_receiver then
        raise exception 'Update changes total thread wei balance (old: [%, %], new: [%, %])',
            OLD.balance_wei_sender / 1e18,
            OLD.balance_wei_receiver / 1e18,
            NEW.balance_wei_sender / 1e18,
            NEW.balance_wei_receiver / 1e18;
    end if;

    if OLD.balance_wei_sender + OLD.balance_wei_receiver <> NEW.balance_wei_sender + NEW.balance_wei_receiver then
        raise exception 'Update changes total thread token balance (old: [%, %], new: [%, %])',
            OLD.balance_token_hub / 1e18,
            OLD.balance_token_user / 1e18,
            NEW.balance_token_hub / 1e18,
            NEW.balance_token_user / 1e18;
    end if;

    -- Check that receiver balance increases
    if NEW.balance_wei_sender > OLD.balance_wei_sender then
        raise exception 'Update is not sending thread wei balance in the right direction (old: [%, %], new: [%, %])',
            OLD.balance_wei_receiver / 1e18,
            OLD.balance_wei_sender / 1e18,
            NEW.balance_wei_receiver / 1e18,
            NEW.balance_wei_sender / 1e18;
    end if;

    if NEW.balance_token_sender > OLD.balance_token_sender then
        raise exception 'Update is not sending thread token balance in the right direction (old: [%, %], new: [%, %])',
            OLD.balance_token_sender / 1e18,
            OLD.balance_token_receiver / 1e18,
            NEW.balance_token_sender / 1e18,
            NEW.balance_token_receiver / 1e18;
    end if;

    -- Check that the tx count increases monotonically
    if NEW.tx_count < OLD.tx_count then
        raise exception 'Update lowers channel tx_count (old: %, new: %)',
            NEW.tx_count,
            OLD.tx_count;
    end if;

    if NEW.sender_channel_id <> OLD.sender_channel_id then
        raise exception 'Update changes sender_channel_id from % to %',
            OLD.sender_channel_id,
            NEW.sender_channel_id;
    end if;


    if NEW.receiver_channel_id <> OLD.receiver_channel_id then
        raise exception 'Update changes receiver_channel_id from % to %',
            OLD.receiver_channel_id,
            NEW.receiver_channel_id;
    end if;

    -- TODO: Probably more checks
    return NEW;
end;
$pgsql$;

create trigger cm_threads_check_update_trigger
before update on _cm_threads
for each row execute procedure cm_threads_check_update_trigger();


create or replace function cm_threads_check_insert_trigger()
returns trigger language plpgsql as
$pgsql$
declare
    sender_chan cm_channels;
    receiver_chan cm_channels;
begin
    sender_chan := (
        select row(c.*)
        from cm_channels as c
        where id = NEW.sender_channel_id
    );
    receiver_chan := (
        select row(c.*)
        from cm_channels as c
        where id = NEW.receiver_channel_id
    );

    if sender_chan.contract is distinct from receiver_chan.contract then
        raise exception 'Contract address on sender + receiver channels do not match: %: % <> %: %',
            NEW.sender_channel_id,
            sender_chan.contract,
            NEW.receiver_channel_id,
            receiver_chan.contract;
    end if;

    return NEW;
end;
$pgsql$;


create trigger cm_threads_check_insert_trigger
before insert on _cm_threads
for each row execute procedure cm_threads_check_insert_trigger();

--
-- cm_thread_updates
--

create table _cm_thread_updates (
    id bigserial primary key,
    thread_pk bigint references _cm_threads(id),
    created_on timestamp with time zone not null,

    <%= THREAD_STATE_COLS.map(c => `${c.name} ${c.sql}`).join(', ') %>
);

create unique index cm_thread_updates_thread_txcount_unique
on _cm_thread_updates (thread_pk, thread_id, tx_count);

alter table _cm_threads
add constraint latest_update_id_fk
foreign key (latest_update_id)
references _cm_thread_updates(id) deferrable initially deferred;

create view cm_thread_updates as (
    select
        tu.id,
        tu.thread_pk,
        tu.created_on,
        t.status as thread_status,

        t.contract,
        t.status,
        t.sender,
        t.receiver,

        <%= THREAD_STATE_COLS.map(c => `tu.${c.name}`).join(', ') %>
    from _cm_thread_updates as tu
    inner join cm_threads as t on t.id = tu.thread_pk
);

--
-- create and update threads
--

create function cm_thread_insert_state (
    -- TODO: trigger to check that these are actually OpenThread / CloseThread
    -- state updates
    _sender_open_update_id bigint,
    _receiver_open_update_id bigint,
    _sender_close_update_id bigint,
    _receiver_close_update_id bigint,
    update_obj jsonb -- matching the SignedThreadState interface
)
returns cm_thread_updates
language plpgsql as $pgsql$
declare
    _contract csw_eth_address := json_not_null(update_obj, 'contractAddress', 'hex');
    _sender csw_eth_address := json_not_null(update_obj, 'sender', 'hex');
    _receiver csw_eth_address := json_not_null(update_obj, 'receiver', 'hex');
    _thread_id integer := json_not_null(update_obj, 'threadId', 'uint256')::integer;
    _tx_count integer := json_not_null(update_obj, 'txCount', 'uint256')::integer;
    _thread _cm_threads;
    _sender_channel_id bigint;
    _receiver_channel_id bigint;
    _update_row _cm_thread_updates;
    _last_thread_id bigint;
begin
    _sender_channel_id = (
        select id from _cm_channels
        where
            "user" = _sender and
            contract = _contract
    );

    _receiver_channel_id = (
        select id from _cm_channels
        where
            "user" = _receiver and
            contract = _contract
    );

    if _sender_channel_id is null or _receiver_channel_id is null then
        raise exception 'one or both channels do not exist: contract: %, sender: %, sender chan: %, receiver: %, receiver chan: %',
            _contract,
            _sender,
            _sender_channel_id,
            _receiver,
            _receiver_channel_id;
    end if;

    _thread := (
        select row (t.*) from _cm_threads t
        where
            sender_channel_id = _sender_channel_id and
            receiver_channel_id = _receiver_channel_id
            and status <> 'CT_CLOSED'
        );

    if _thread.status = 'CT_IN_DISPUTE' then
        raise exception 'cannot update thread that is in dispute';
    end if;

    if _thread.id is null then
        -- create thread

        _last_thread_id = (
            select max(thread_id)
            from _cm_threads 
            where 
                sender_channel_id = _sender_channel_id and
                receiver_channel_id = _receiver_channel_id
        );

        if _thread_id <= _last_thread_id then
            raise exception 'thread state update would open a new thread, but new thread_id % <= previous thread_id: %',
              _thread_id,
              _last_thread_id;
        end if;

        if _tx_count is distinct from 0 then
            raise exception 'thread state update would open a new thread, but new tx_count % <> 0',
              _tx_count;
        end if;

        insert into _cm_threads (
            sender_channel_id, receiver_channel_id,
            sender_open_update_id, receiver_open_update_id,
            sender, receiver,
            status
        ) values (
            _sender_channel_id, _receiver_channel_id,
            _sender_open_update_id, _receiver_open_update_id,
            _sender, _receiver,
            'CT_OPEN'
        ) returning * into _thread;
    end if;

    -- update thread
    insert into _cm_thread_updates (
        thread_pk, created_on,
        <%= THREAD_STATE_COLS.map(c => c.name).join(', ') %>
    ) values (
        _thread.id, now(),
        <%= THREAD_STATE_COLS.map(c => colGetFromJson('update_obj', c)).join(', ') %>
    ) returning * into _update_row;

    return (
      select row(tu.*)
      from cm_thread_updates as tu
      where id = _update_row.id
    );
end
$pgsql$;

create or replace function cm_thread_updates_post_insert_trigger()
returns trigger language plpgsql as
$pgsql$
declare
    latest_update cm_thread_updates;
begin

    select *
    from cm_thread_updates
    where id = NEW.id
    into latest_update;

    update _cm_threads
    set
        latest_update_id = latest_update.id,
        last_updated_on = latest_update.created_on,
        <%= THREAD_STATE_COLS.map(c => `${c.name} = latest_update.${c.name}`).join(', ') %>
    where id = latest_update.thread_pk;

    return NEW;
end;
$pgsql$;

create trigger cm_thread_updates_post_insert_trigger
after insert or update on _cm_thread_updates
for each row execute procedure cm_thread_updates_post_insert_trigger();

-- TODO: This needs to track the reason the thread's status is being closed
create function cm_thread_update_status (
    _thread_pk bigint,
    _status cm_thread_status
)
returns bool
language plpgsql as $pgsql$
declare
    _cm_thread _cm_threads;
begin
    _cm_thread := (select row (t.*) from _cm_threads t where id = _thread_pk);

    if _cm_thread is null
    then
        raise exception 'thread not found';
    end if;

    if _status = 'CT_IN_DISPUTE'
    then
        raise exception 'dispute status must be changed from an onchain event';
    end if;

    if _cm_thread.status = _status
    then
        return false;
    end if;

    update _cm_threads set status = _status where id = _thread_pk;
    return true;
end
$pgsql$;

--
-- Misc helper functions
--

-- Internal. Normalizes (ensures there is a 0x prefix) and validates a hex string.
create function hex_normalize(field text, val text, allow_null boolean = false)
returns text
language plpgsql immutable as $pgsql$
declare
    res text := lower(val);
begin
    if res like '0x%' then
        res := substring(res from 3);
    end if;
    if res ~ '[^a-f0-9]' then
        if allow_null then
            return null;
        end if;
        raise exception '% is not a valid hex string: %', field, val;
    end if;
    return '0x' || res;
end
$pgsql$;

-- Internal. Extracts ``field`` from ``jsonb obj``, or `null`.
create function json_null(obj jsonb, field text, cast_as text = null)
returns text
language plpgsql immutable called on null input as $pgsql$
declare
    res text := (obj->>field);
begin
    if res is null then
        return null;
    end if;

    if cast_as = 'hex' then
        res := hex_normalize(field, res);
    elsif cast_as like 'uint%' then
        if not (res ~ '^[0-9]+$') then
            raise exception '%: invalid %: %', field, cast_as, res;
        end if ;
    elsif cast_as is not null then
        raise exception 'invalid value for cast_as argument: %', cast_as;
    end if;
    return res;
end
$pgsql$;

-- Internal. Extracts ``field`` from ``jsonb obj``,and throws an exception
-- if the result (or any of the input) is null.
create function json_not_null(obj jsonb, field text, cast_as text = null)
returns text
language plpgsql immutable called on null input as $pgsql$
declare
    res text := json_null(obj, field, cast_as);
begin
    if res is null then
        raise exception '% must not be null', field using errcode = 'null_value_not_allowed';
    end if;
    return res;
end
$pgsql$;



--
-- chainsaw event functions
--


create function chainsaw_insert_event(
    hub csw_eth_address,
    _contract csw_eth_address,

    block_number integer,
    block_hash csw_sha3_hash,
    _tx_hash csw_sha3_hash,
    _log_index integer,
    _tx_index integer,

    sender csw_eth_address,

    js_timestamp double precision,
    event_type cm_event_type,
    fields jsonb
)
returns jsonb
language plpgsql as $pgsql$
declare
    _user csw_eth_address;
    chainsaw_event chainsaw_events;
    ts timestamp with time zone := to_timestamp(js_timestamp / 1000.0);
    chan_create_error text;
    channel _cm_channels;
    row_count integer;
    err_msg text;
begin
    if event_type <> 'DidHubContractWithdraw' then
        _user := json_not_null(fields, 'user', 'hex')::csw_eth_address;
        channel := (
            select row(c.*)
            from cm_channels as c
            where
                contract = _contract and
                "user" = _user
        );

        if channel.id is null then
            -- For now, refuse to create a channel unless the event we're creating
            -- in response to is the first in the channel. This can probably be
            -- relaxed at some point… but it seems reasonable for now.
            if jsonb_extract_path_text(fields, 'txCount', '0') <> '1' then
                raise exception 'Refusing to create channel in response to % (fields: %; tx: %) when txCount[0] <> 1',
                    event_type,
                    fields::text,
                    _tx_hash;
            end if;

            begin
              insert into _cm_channels (contract, hub, "user", recipient)
              values (_contract, hub, _user, _user)
              returning * into channel;
            exception when unique_violation then
              channel := (
                  select row(c.*)
                  from cm_channels as c
                  where
                      contract = _contract and
                      "user" = _user
              );
            end;
        end if;
    end if;

    -- Insert the chainsaw event

    insert into chainsaw_events (
        contract,
        ts,
        block_hash, block_number, tx_hash, log_index, tx_index,
        sender,
        channel_id, event_type, fields
    )
    values (
        _contract,
        ts,
        block_hash, block_number, _tx_hash, _log_index, _tx_index,
        sender,
        channel.id, event_type, fields
    )
    returning * into chainsaw_event;

    if jsonb_extract_path_text(fields, 'txCount', '1') is not null then
        update _cm_channel_updates
        set chainsaw_resolution_event_id = chainsaw_event.id
        where
            channel_id = chainsaw_event.channel_id and
            tx_count_global = jsonb_extract_path_text(fields, 'txCount', '0')::integer and
            tx_count_chain = jsonb_extract_path_text(fields, 'txCount', '1')::integer and (
              chainsaw_resolution_event_id is null or
              chainsaw_resolution_event_id = chainsaw_event.id
            );

        get diagnostics row_count = ROW_COUNT;
        if row_count <> 1 then
            if (
              select true
              from _cm_channel_updates
              where
                  channel_id = chainsaw_event.channel_id and
                  tx_count_global = jsonb_extract_path_text(fields, 'txCount', '0')::integer and
                  tx_count_chain = jsonb_extract_path_text(fields, 'txCount', '1')::integer
            ) then
              err_msg := 'duplicate';
            else
              err_msg := 'no corresponding';
            end if;

            raise exception 'chainsaw event (tx: %, log: %, type: %, fields: %, sender: %, channel: %, txCount: %) has % state update',
                _tx_hash,
                _log_index,
                event_type,
                fields,
                sender,
                channel.id,
                jsonb_extract_path_text(fields, 'txCount'),
                err_msg;
        end if;
    end if;

    return jsonb_build_object(
        'duplicate', false,
        'chainsaw_event_id', chainsaw_event.id,
        'channel_id', channel.id
    );

exception when unique_violation then
    chainsaw_event := (
        select row(e.*)
        from chainsaw_events as e
        where
            tx_hash = _tx_hash and
            log_index = _log_index
    );

    if chainsaw_event.id is null then
        -- This really should never happen... but just to be super careful.
        raise exception 'assertion error: got unexpected unique_violation - % - during chainsaw_insert_event: % % % % % % % % % % %',
          SQLERRM,
          hub,
          _contract,
          block_number,
          block_hash,
          _tx_hash,
          _log_index,
          _tx_index,
          sender,
          js_timestamp,
          event_type,
          fields;
    end if;

    return jsonb_build_object(
        'duplicate', true,
        'chainsaw_event_id', chainsaw_event.id,
        'channel_id', chainsaw_event.channel_id
    );

end
$pgsql$;

alter table chainsaw_poll_events add column poll_type varchar not null default 'FETCH_EVENTS';
alter table chainsaw_poll_events add column tx_idx integer;
alter table chainsaw_poll_events
drop constraint chainsaw_poll_events_block_number_key;
alter table chainsaw_poll_events
add constraint chainsaw_poll_events_block_number_tx_id_unique
unique (block_number, tx_idx);

create or replace function cm_chainsaw_events_since(
  _contract csw_eth_address,
  _block_num integer,
  _tx_index integer
)
  returns setof chainsaw_events
language plpgsql as $pgsql$
declare
  _curr_block_count integer;
begin
  if _tx_index is not null
  then
    _curr_block_count := (select count(*) from chainsaw_events where contract = _contract AND block_number = _block_num AND tx_index > _tx_index);

    if _curr_block_count > 0
    then
      return query select * from chainsaw_events where contract = _contract and block_number >= _block_num and tx_index > _tx_index;
    end if;
  end if;

  return query select * from chainsaw_events where contract = _contract and block_number > _block_num;
end
$pgsql$;

--
-- payments
--

drop view payments;

create table _payments (
  id bigserial primary key,
  purchase_id varchar(64) not null,
  recipient csw_eth_address not null,
  channel_update_id bigint unique references _cm_channel_updates(id) null,
  thread_update_id bigint unique references _cm_thread_updates(id) null,
  amount_wei wei_amount not null,
  amount_token token_amount not null,
  meta jsonb not null,

  check (
    (channel_update_id is null and thread_update_id is not null) or
    (channel_update_id is not null and thread_update_id is null)
  )
);

create index payments_purchase_id on _payments (purchase_id);
create index payments_recipient on _payments (recipient);

-- TODO: trigger to ensure that state updates associated with payments
-- are signed by both parties and are not invalid. Possibly we should also
-- make sure that the update reason is "payment" or similar, to prevent
-- on-chain updates from being used as part of payments.
-- TODO: check that recipient == thread_update.receiver

create view payments as (
  select
    p.id,
    up.created_on,
    up.contract,

    purchase_id,
    up."user" as sender,
    p.recipient,

    amount_wei,
    amount_token,
    meta,

    'PT_CHANNEL' as payment_type,
    up.recipient as custodian_address
  from _payments as p
  inner join cm_channel_updates as up on up.id = p.channel_update_id

  union all

  select
    p.id,
    up.created_on,
    up.contract,

    purchase_id,
    up.sender,
    p.recipient,

    amount_wei,
    amount_token,
    meta,

    'PT_THREAD' as payment_type,
    null as custodian_address
  from _payments as p
  inner join cm_thread_updates as up on up.id = p.thread_update_id
);

-- vim: set shiftwidth=2 tabstop=2 softtabstop=2 :vim
