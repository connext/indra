select hex_normalize('foo', '0x1234ABC');
select hex_normalize('foo', '1234abC');
select hex_normalize('foo', '1234abC', true);
select hex_normalize('foo', 'stuff');
select hex_normalize('foo', null);
select hex_normalize('foo', null, true);

select json_not_null('{"foo": 42}', 'foo');
select json_not_null('{"foo": 42}', 'bar');

create function mk_addr(prefix text) returns csw_eth_address
language sql as $$ select rpad(prefix, 42, '0')::csw_eth_address $$;

create function mk_hash(prefix text) returns csw_sha3_hash
language sql as $$ select rpad(prefix, 66, '0')::csw_sha3_hash $$;

create function mk_sig(prefix text) returns eth_signature
language sql as $$ select rpad(prefix, 132, '0')::eth_signature $$;

create function show_row(r json)
returns jsonb
language plpgsql as $pgsql$
declare
    res text;
begin
    res := r::text;
    res := regexp_replace(res, '"2\d{3}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d+[^"]*"', '"<date>"', 'g');
    return res;
end;
$pgsql$;


--
-- Chainsaw events
--

-- Insert a DidHubContractWithdraw chainsaw event
select chainsaw_insert_event(
    mk_addr('0x1ABC'), mk_addr('0x2ABC'),

    69, mk_hash('0x69ABC'), mk_hash('0x6969ABC'), 1, 1,

    mk_addr('0x3ABC'),

    extract(epoch from now()) * 1000,
    'DidHubContractWithdraw',
    '{}'::jsonb
);

-- Insert a duplicate chainsaw event
select chainsaw_insert_event(
    mk_addr('0x1ABC'), mk_addr('0x2ABC'),

    69, mk_hash('0x69ABC'), mk_hash('0x6969ABC'), 1, 1,

    mk_addr('0x3ABC'),

    extract(epoch from now()) * 1000,
    'DidHubContractWithdraw',
    '{}'::jsonb
);

-- Insert an initial chainsaw event
select chainsaw_insert_event(
    mk_addr('0x1ABC'), mk_addr('0x2ABC'),

    69, mk_hash('0x69ABC'), mk_hash('0x6969ABC'), 2, 1,

    mk_addr('0x3ABC'),

    extract(epoch from now()) * 1000,
    'DidUpdateChannel',
    jsonb_build_object('user', mk_addr('0x3ABC'))
);

-- Insert a subsequent chainsaw event
select chainsaw_insert_event(
    mk_addr('0x1ABC'), mk_addr('0x2ABC'),

    69, mk_hash('0x69ABC'), mk_hash('0x6969ABC'), 3, 1,

    mk_addr('0x3ABC'),

    extract(epoch from now()) * 1000,
    'DidUpdateChannel',
    jsonb_build_object('user', mk_addr('0x3ABC'))
);

--
-- channel state updates
--

-- Inserting a state
select show_row(row_to_json(cm_channel_insert_or_update_state(
    mk_addr('0x1abc'), mk_addr('0x2abc'), mk_addr('0x3abc'),

    'Payment', '{}',

    mk_addr('0x3ABC'),

    null, null,

    jsonb_build_object(
        'recipient', mk_addr('0x3ABC'),

        'balanceWeiHub', '6',
        'balanceWeiUser', '9',

        'balanceTokenHub', '69',
        'balanceTokenUser', '96',

        'txCountGlobal', '1',
        'txCountChain', '1',

        'threadRoot', mk_hash('0x0'),
        'threadCount', '0',

        'sigHub', mk_sig('0x123')
    )
)));

select recipient, sig_hub, sig_user, latest_update_id
from cm_channels
where "user" = mk_addr('0x3abc');

-- Inserting a duplicate state
select show_row(row_to_json(cm_channel_insert_or_update_state(
    mk_addr('0x1abc'), mk_addr('0x2abc'), mk_addr('0x3abc'),

    'Payment', '{}',
    mk_addr('0x3ABC'),

    null, null,

    jsonb_build_object(
        'recipient', mk_addr('0x3ABC'),

        'balanceWeiHub', '6',
        'balanceWeiUser', '9',

        'balanceTokenHub', '69',
        'balanceTokenUser', '96',

        'txCountGlobal', '1',
        'txCountChain', '1',

        'threadRoot', mk_hash('0x0'),
        'threadCount', '0',

        'sigHub', mk_sig('0x123')
    )
)));

select recipient, sig_hub, sig_user, latest_update_id
from cm_channels
where "user" = mk_addr('0x3abc');

-- Inserting a duplicate state that updates the user's sig
select show_row(row_to_json(cm_channel_insert_or_update_state(
    mk_addr('0x1abc'), mk_addr('0x2abc'), mk_addr('0x3abc'),

    'Payment', '{}',
    mk_addr('0x3ABC'),

    null, null,

    jsonb_build_object(
        'recipient', mk_addr('0x3ABC'),

        'balanceWeiHub', '6',
        'balanceWeiUser', '9',

        'balanceTokenHub', '69',
        'balanceTokenUser', '96',

        'txCountGlobal', '1',
        'txCountChain', '1',

        'threadRoot', mk_hash('0x0'),
        'threadCount', '0',

        'sigHub', mk_sig('0x123'),
        'sigUser', mk_sig('0x456')
    )
)));

select recipient, sig_hub, sig_user, latest_update_id
from cm_channels
where "user" = mk_addr('0x3abc');

-- Inserting a new state update
select show_row(row_to_json(cm_channel_insert_or_update_state(
    mk_addr('0x1abc'), mk_addr('0x2abc'), mk_addr('0x3abc'),

    'Payment', '{}',
    mk_addr('0x3ABC'),

    null, null,

    jsonb_build_object(
        'recipient', mk_addr('0x3ABC'),

        'balanceWeiHub', '5',
        'balanceWeiUser', '10',

        'balanceTokenHub', '68',
        'balanceTokenUser', '97',

        'txCountGlobal', '2',
        'txCountChain', '1',

        'threadRoot', mk_hash('0x0'),
        'threadCount', '0',

        'sigHub', mk_sig('0x123'),
        'sigUser', mk_sig('0x456')
    )
)));

select recipient, sig_hub, sig_user, latest_update_id
from cm_channels
where "user" = mk_addr('0x3abc');


-- Chainsaw event resolving the state

select count(*)
from cm_channel_updates
where chainsaw_resolution_event_id is not null;


select chainsaw_insert_event(
    mk_addr('0x1ABC'), mk_addr('0x2ABC'),

    69, mk_hash('0x69ABC'), mk_hash('0x6969ABC'), 4, 1,

    mk_addr('0x3ABC'),

    extract(epoch from now()) * 1000,
    'DidUpdateChannel',
    jsonb_build_object(
        'user', mk_addr('0x3ABC'),
        'txCount', '[1, 1]'::jsonb
    )
);

select count(*)
from cm_channel_updates
where chainsaw_resolution_event_id is not null;

select recipient, sig_hub, sig_user, latest_update_id
from cm_channels
where "user" = mk_addr('0x3abc');

--
-- Double check that addresses are case insensitive
--

select contract
from chainsaw_events
where contract like '0x2abc%';

select block_hash
from chainsaw_events
where block_hash like '0x69abc%';

select tx_hash
from chainsaw_events
where tx_hash like '0x6969abc%';

select sender
from chainsaw_events
where sender like '0x3abc%';

--
-- Creating a channel by inserting a state update
--

select show_row(row_to_json(cm_channel_insert_or_update_state(
    mk_addr('0x1FFF'), mk_addr('0x2FFF'), mk_addr('0x3FFF'),

    'Payment', '{}',
    mk_addr('0x3FFF'),

    null, null,

    jsonb_build_object(
        'recipient', mk_addr('0x3FFF'),

        'balanceWeiHub', '6',
        'balanceWeiUser', '9',

        'balanceTokenHub', '69',
        'balanceTokenUser', '96',

        'txCountGlobal', '1',
        'txCountChain', '1',

        'threadRoot', mk_hash('0x0'),
        'threadCount', '0',

        'sigHub', mk_sig('0x123'),
        'sigUser', mk_sig('0x456')
    )
)));

--
-- This is a new channel, but the txcount isn't 1, so it should fail
--
select show_row(row_to_json(cm_channel_insert_or_update_state(
    mk_addr('0x1FFF'), mk_addr('0x2FCFC'), mk_addr('0x3FFF'),

    'Payment', '{}',
    mk_addr('0x3FFF'),

    null, null,

    jsonb_build_object(
        'recipient', mk_addr('0x3FFF'),

        'balanceWeiHub', '6',
        'balanceWeiUser', '9',

        'balanceTokenHub', '69',
        'balanceTokenUser', '96',

        'txCountGlobal', '69',
        'txCountChain', '1',

        'threadRoot', mk_hash('0x0'),
        'threadCount', '0',

        'sigHub', mk_sig('0x123'),
        'sigUser', mk_sig('0x456')
    )
)));
