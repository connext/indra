do $pgsql$
declare
    sender_create_update cm_channel_updates;
    receiver_create_update cm_channel_updates;
    contract_address csw_eth_address := mk_addr('0x2FCFC');
    sender csw_eth_address := mk_addr('0x5555');
    receiver csw_eth_address := mk_addr('0x1212');

begin

    --
    -- Create channel for sender
    --
    sender_create_update := (
        select cm_channel_insert_or_update_state(
            mk_addr('0x69FFF'), contract_address, sender,

            'OpenThread',
            sender,

            null,

            jsonb_build_object(
                'recipient', sender,

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
        )
    );

    --
    -- Create channel for receiver
    --
    receiver_create_update := (
        select cm_channel_insert_or_update_state(
            mk_addr('0x69FFF'), contract_address, receiver,

            'OpenThread',
            receiver,

            null,

            jsonb_build_object(
                'recipient', receiver,

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
        )
    );

    raise notice 'thread state: %', show_row(row_to_json(cm_thread_insert_state(
        _sender_open_update_id := sender_create_update.id,
        _receiver_open_update_id := receiver_create_update.id,
        _sender_close_update_id := null,
        _receiver_close_update_id := null,
        update_obj := jsonb_build_object(
            'contractAddress', contract_address,
            'sender', sender,
            'receiver', receiver,
            'threadId', 1,
            'txCount', 0,
            'balanceWeiSender', '5',
            'balanceWeiReceiver', '0',
            'balanceTokenSender', '55',
            'balanceTokenReceiver', '1',
            'sigA', mk_sig('0xa')
        )
    )));

    raise notice 'thread row: %', show_row((
        select row_to_json(t.*)
        from cm_threads as t
        where sender_channel_id = sender_create_update.channel_id
    ));

end;
$pgsql$;
