--
-- PostgreSQL database dump
--

CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE calculation_method AS ENUM (
  'WEI_SUM',
  'PEGGED_FIAT'
);

CREATE TYPE channel_claim_status AS ENUM (
  'NEW',
  'PENDING',
  'CONFIRMED',
  'FAILED'
);


CREATE TYPE cm_channel_status AS ENUM (
  'CS_OPEN',
  'CS_CHANNEL_DISPUTE',
  'CS_THREAD_DISPUTE'
);

CREATE TYPE cm_channel_update_invalid_reason AS ENUM (
  'CU_INVALID_TIMEOUT',
  'CU_INVALID_REJECTED',
  'CU_INVALID_ERROR'
);

CREATE TYPE cm_channel_update_reason AS ENUM (
  'Payment',
  'Exchange',
  'ProposePendingDeposit',
  'ProposePendingWithdrawal',
  'ConfirmPending',
  'OpenThread',
  'CloseThread',
  'Invalidation',
  'EmptyChannel'
);

CREATE TYPE cm_event_type AS ENUM (
  'DidHubContractWithdraw',
  'DidUpdateChannel',
  'DidStartExitChannel',
  'DidEmptyChannel',
  'DidStartExitThread',
  'DidEmptyThread',
  'DidNukeThread'
);

CREATE TYPE cm_thread_status AS ENUM (
  'CT_CLOSED',
  'CT_OPEN',
  'CT_IN_DISPUTE'
);

CREATE TYPE csw_channel_event_type AS ENUM (
  'DidOpen',
  'DidDeposit',
  'DidClaim',
  'DidStartSettling',
  'DidSettle'
);

CREATE TYPE csw_channel_state AS ENUM (
  'CS_OPEN',
  'CS_SETTLING',
  'CS_SETTLED'
);

CREATE DOMAIN csw_eth_address AS citext
  CONSTRAINT csw_eth_address_check CHECK ((VALUE OPERATOR(~*) '^0x[a-f0-9]{40}$'::citext));

CREATE TYPE csw_ledger_channel_state AS ENUM (
  'LCS_OPENING',
  'LCS_OPENED',
  'LCS_SETTLING',
  'LCS_SETTLED'
);

CREATE DOMAIN csw_sha3_hash AS citext
  CONSTRAINT csw_sha3_hash_check CHECK ((VALUE OPERATOR(~*) '^0x[a-f0-9]{64}$'::citext));

CREATE TYPE csw_virtual_channel_state AS ENUM (
  'VCS_OPENING',
  'VCS_OPENED',
  'VCS_SETTLING',
  'VCS_SETTLED'
);

CREATE TYPE disbursements_status AS ENUM (
  'NEW',
  'PENDING',
  'CONFIRMED',
  'FAILED'
);

CREATE DOMAIN eth_signature AS character varying(132)
  CONSTRAINT eth_signature_check CHECK (((VALUE)::text ~* '^0x[a-f0-9]{130}$'::text));

CREATE DOMAIN fiat_amount AS numeric(78,2);

CREATE TYPE ledger_channel_state_update_reason AS ENUM (
  'VC_OPENED',
  'VC_CLOSED',
  'LC_DEPOSIT',
  'LC_FAST_CLOSE'
);

CREATE TYPE onchain_transaction_state AS ENUM (
  'new',
  'submitted',
  'confirmed',
  'failed'
);

CREATE DOMAIN token_amount AS numeric(78,0);

CREATE DOMAIN wei_amount AS numeric(78,0);

CREATE TYPE withdrawal_status AS ENUM (
  'NEW',
  'PENDING',
  'CONFIRMED',
  'FAILED'
);

SET default_tablespace = '';

SET default_with_oids = false;
CREATE TABLE chainsaw_events (
  id bigint NOT NULL,
  contract csw_eth_address NOT NULL,
  ts timestamp with time zone NOT NULL,
  block_number integer NOT NULL,
  block_hash csw_sha3_hash NOT NULL,
  tx_hash csw_sha3_hash NOT NULL,
  tx_index integer NOT NULL,
  log_index integer NOT NULL,
  sender csw_eth_address NOT NULL,
  channel_id bigint,
  event_type cm_event_type NOT NULL,
  fields jsonb NOT NULL
);

CREATE FUNCTION applicable_exchange_rate(ts bigint, epsilon integer DEFAULT (((24 * 60) * 60) * 1000), OUT id bigint, OUT retrievedat bigint, OUT base character varying, OUT rate_usd fiat_amount) RETURNS record
LANGUAGE plpgsql
AS $$
BEGIN
  SELECT e.id, e.retrievedat, e.base, e.rate_usd INTO id, retrievedat, base, rate_usd FROM exchange_rates e WHERE e.retrievedat <= ts AND ts - e.retrievedat <= epsilon ORDER BY e.retrievedat DESC LIMIT 1;
  IF (SELECT id) IS NULL THEN
    RAISE 'no valid exchange rate found within % ms', epsilon;
  END IF;
  RETURN;
END;
$$;

CREATE FUNCTION cm_chainsaw_events_since(_contract csw_eth_address, _block_num integer, _tx_index integer) RETURNS SETOF chainsaw_events
LANGUAGE plpgsql
AS $$
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
$$;

-- Note: _cm_channel_updates has the underscore prefix because it is never meant to be
-- queried directly. Instead, the `cm_channel_updates` view should be used. This is to
-- prevent people from trying to insert or update on it directly.
CREATE TABLE _cm_channel_updates (
  id bigint NOT NULL,
  channel_id bigint,
  created_on timestamp with time zone DEFAULT now() NOT NULL,
  reason cm_channel_update_reason NOT NULL,
  args jsonb NOT NULL,
  originator csw_eth_address NOT NULL,

  -- TODO: needed to add this to have user accessible in channel updates
  "user" csw_eth_address NOT NULL,

  -- Usually the hub will sign updates before they are put into the database,
  -- except in the case of hub-proposed exchanges, where hub will insert an
  -- un-signed update that will be sync'd to the wallet, which the wallet
  -- will sign and send back.
  -- Note: this also implies that the "sync()" mechanism can only send state
  -- updates. Potentially a better way to do this will be to allow more
  -- general messages to be sync'd?
  invalid cm_channel_update_invalid_reason,
  hub_signed_on timestamp with time zone NOT NULL,
  user_signed_on timestamp with time zone,
  recipient csw_eth_address NOT NULL,
  balance_wei_hub wei_amount NOT NULL,
  balance_wei_user wei_amount NOT NULL,
  balance_token_hub token_amount NOT NULL,
  balance_token_user token_amount NOT NULL,
  pending_deposit_wei_hub wei_amount,
  pending_deposit_wei_user wei_amount,
  pending_deposit_token_hub token_amount,
  pending_deposit_token_user token_amount,
  pending_withdrawal_wei_hub wei_amount,
  pending_withdrawal_wei_user wei_amount,
  pending_withdrawal_token_hub token_amount,
  pending_withdrawal_token_user token_amount,
  tx_count_global integer NOT NULL,
  tx_count_chain integer NOT NULL,
  thread_root csw_sha3_hash,
  thread_count integer NOT NULL,
  timeout integer,
  sig_hub eth_signature NOT NULL,
  sig_user eth_signature,

  -- The ID of the chainsaw event which caused this update
  chainsaw_event_id bigint,

  -- The ID of the chainsaw event which resolved this pending update (ie,
  -- if this update introduces pending values, this will be the ID of the
  -- chainsaw event which confirms those values).
  chainsaw_resolution_event_id bigint,

  -- The ID of the onchain transaction corresponding to this update
  onchain_tx_logical_id bigint, -- references onchain_transactions_raw(logical_id) and checked by trigger
  CONSTRAINT _cm_channel_updates_check CHECK (
    CASE
    WHEN (sig_user IS NULL) THEN (user_signed_on IS NULL)
    ELSE (user_signed_on IS NOT NULL)
    END),
  CONSTRAINT _cm_channel_updates_check1 CHECK (
    CASE
    WHEN ((thread_root)::citext OPERATOR(~) '^0x0+$'::citext) THEN (thread_count = 0)
    ELSE (thread_count > 0)
    END),
  CONSTRAINT _cm_channel_updates_thread_count_check CHECK ((thread_count >= 0))
);

-- Note: _cm_channels has the underscore prefix because it is never meant to be
-- queried directly. Instead, the `cm_channels` view should be used. This is to
-- prevent people from trying to insert or update on it directly.
CREATE TABLE _cm_channels (
  id bigint NOT NULL,
  contract csw_eth_address NOT NULL,
  hub csw_eth_address NOT NULL,
  "user" csw_eth_address NOT NULL,
  status cm_channel_status DEFAULT 'CS_OPEN'::cm_channel_status NOT NULL,
  hub_signed_on timestamp with time zone,
  user_signed_on timestamp with time zone,
  reason cm_channel_update_reason,
  args jsonb,
  recipient csw_eth_address,
  balance_wei_hub wei_amount,
  balance_wei_user wei_amount,
  balance_token_hub token_amount,
  balance_token_user token_amount,
  pending_deposit_wei_hub wei_amount,
  pending_deposit_wei_user wei_amount,
  pending_deposit_token_hub token_amount,
  pending_deposit_token_user token_amount,
  pending_withdrawal_wei_hub wei_amount,
  pending_withdrawal_wei_user wei_amount,
  pending_withdrawal_token_hub token_amount,
  pending_withdrawal_token_user token_amount,
  tx_count_global integer,
  tx_count_chain integer,
  thread_root csw_sha3_hash,
  thread_count integer,
  timeout integer,
  sig_hub eth_signature,
  sig_user eth_signature,
  latest_update_id bigint,
  last_updated_on timestamp with time zone,
  channel_dispute_event_id bigint,
  channel_dispute_ends_on timestamp with time zone,
  channel_dispute_originator csw_eth_address,
  thread_dispute_event_id bigint,
  thread_dispute_ends_on timestamp with time zone,
  thread_dispute_originator csw_eth_address,
  CONSTRAINT _cm_channels_check CHECK (
    CASE status
    WHEN 'CS_OPEN'::cm_channel_status THEN (COALESCE(channel_dispute_event_id, thread_dispute_event_id) IS NULL)
    WHEN 'CS_CHANNEL_DISPUTE'::cm_channel_status THEN ((channel_dispute_event_id IS NOT NULL) AND (thread_dispute_event_id IS NULL))
    WHEN 'CS_THREAD_DISPUTE'::cm_channel_status THEN ((channel_dispute_event_id IS NULL) AND (thread_dispute_event_id IS NOT NULL))
    ELSE NULL::boolean
    END),
  CONSTRAINT _cm_channels_check1 CHECK (
    CASE
    WHEN ((thread_root)::citext OPERATOR(~) '^0x0+$'::citext) THEN (thread_count = 0)
    ELSE (thread_count > 0)
    END),
  CONSTRAINT _cm_channels_thread_count_check CHECK ((thread_count >= 0))
);

CREATE FUNCTION chainsaw_insert_event(hub csw_eth_address, _contract csw_eth_address, block_number integer, block_hash csw_sha3_hash, _tx_hash csw_sha3_hash, _log_index integer, _tx_index integer, sender csw_eth_address, js_timestamp double precision, event_type cm_event_type, fields jsonb) RETURNS jsonb
LANGUAGE plpgsql
AS $$
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
        insert into _cm_channels (
          contract, hub, "user", recipient,

          balance_wei_hub, balance_wei_user,
          balance_token_hub, balance_token_user,

          pending_deposit_wei_hub, pending_deposit_wei_user,
          pending_deposit_token_hub, pending_deposit_token_user,

          pending_withdrawal_wei_hub, pending_withdrawal_wei_user,
          pending_withdrawal_token_hub, pending_withdrawal_token_user,

          tx_count_global, tx_count_chain,

          thread_root, thread_count,

          timeout
          )
        values (
                 _contract, hub, _user, _user,

                 '0', '0',
                 '0', '0',

                 '0', '0',
                 '0', '0',

                 '0', '0',
                 '0', '0',

                 0, 0,

                 '0x0000000000000000000000000000000000000000000000000000000000000000', 0,

                 0
                 )
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
$$;

CREATE VIEW cm_channels AS
  SELECT _cm_channels.id,
         _cm_channels.contract,
         _cm_channels.hub,
         _cm_channels."user",
         _cm_channels.status,
         _cm_channels.hub_signed_on,
         _cm_channels.user_signed_on,
         _cm_channels.reason,
         _cm_channels.args,
         _cm_channels.recipient,
         _cm_channels.balance_wei_hub,
         _cm_channels.balance_wei_user,
         _cm_channels.balance_token_hub,
         _cm_channels.balance_token_user,
         _cm_channels.pending_deposit_wei_hub,
         _cm_channels.pending_deposit_wei_user,
         _cm_channels.pending_deposit_token_hub,
         _cm_channels.pending_deposit_token_user,
         _cm_channels.pending_withdrawal_wei_hub,
         _cm_channels.pending_withdrawal_wei_user,
         _cm_channels.pending_withdrawal_token_hub,
         _cm_channels.pending_withdrawal_token_user,
         _cm_channels.tx_count_global,
         _cm_channels.tx_count_chain,
         _cm_channels.thread_root,
         _cm_channels.thread_count,
         _cm_channels.timeout,
         _cm_channels.sig_hub,
         _cm_channels.sig_user,
         _cm_channels.latest_update_id,
         _cm_channels.last_updated_on,
         _cm_channels.channel_dispute_event_id,
         _cm_channels.channel_dispute_ends_on,
         _cm_channels.channel_dispute_originator,
         _cm_channels.thread_dispute_event_id,
         _cm_channels.thread_dispute_ends_on,
         _cm_channels.thread_dispute_originator
  FROM _cm_channels;

CREATE VIEW cm_channel_updates AS
  SELECT cu.id,
         cu.channel_id,
         cu.created_on,
         cu.reason,
         cu.args,
         cu.originator,
         cu."user",
         cu.invalid,
         cu.hub_signed_on,
         cu.user_signed_on,
         cu.recipient,
         cu.balance_wei_hub,
         cu.balance_wei_user,
         cu.balance_token_hub,
         cu.balance_token_user,
         cu.pending_deposit_wei_hub,
         cu.pending_deposit_wei_user,
         cu.pending_deposit_token_hub,
         cu.pending_deposit_token_user,
         cu.pending_withdrawal_wei_hub,
         cu.pending_withdrawal_wei_user,
         cu.pending_withdrawal_token_hub,
         cu.pending_withdrawal_token_user,
         cu.tx_count_global,
         cu.tx_count_chain,
         cu.thread_root,
         cu.thread_count,
         cu.timeout,
         cu.sig_hub,
         cu.sig_user,
         cu.chainsaw_event_id,
         cu.chainsaw_resolution_event_id,
         cu.onchain_tx_logical_id,
         c.contract
  FROM (_cm_channel_updates cu
    JOIN cm_channels c ON ((c.id = cu.channel_id)));

CREATE FUNCTION cm_channel_insert_or_update_state(
  _hub csw_eth_address,
  _contract csw_eth_address,
  _user csw_eth_address,
  reason cm_channel_update_reason,
  args jsonb,
  originator csw_eth_address,
  _chainsaw_event_id bigint,
  _onchain_tx_logical_id bigint,

  -- matching the SignedChannelupdate interface
  update_obj jsonb
) RETURNS cm_channel_updates
LANGUAGE plpgsql
AS $$
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
                  tx_count_global = json_not_null(update_obj, 'txCountGlobal', 'uint256')::bigint and
                  invalid is null
                );

  if update_row.id is not null then

    if update_row.sig_hub is distinct from _sig_hub then
      raise exception 'update attempts to change sig_hub on update % (txCount=%) from % to % (this is likely indicative of a race condition where two different updates are generated at the same time with the same txCount)',
      update_row.id,
      update_row.tx_count_global,
      update_row.sig_hub,
      _sig_hub;
    end if;

    if _sig_user is null then
      raise exception 'attempt to update an existing state, but no sig_user provided. this likely indicates a race condition where two identical states are generated at the same time (for example, two identical tips are sent at once). Update txCount=% with sigHub=%.',
      update_row.tx_count_global,
      update_row.sig_hub;
    end if;

    if _sig_user is not null and _sig_user is distinct from update_row.sig_user then
      if update_row.sig_user is not null then
        raise exception 'update attempts to change user signature on update % from % to %!',
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

      recipient, balance_wei_hub, balance_wei_user, balance_token_hub, balance_token_user, pending_deposit_wei_hub, pending_deposit_wei_user, pending_deposit_token_hub, pending_deposit_token_user, pending_withdrawal_wei_hub, pending_withdrawal_wei_user, pending_withdrawal_token_hub, pending_withdrawal_token_user, tx_count_global, tx_count_chain, thread_root, thread_count, timeout, sig_hub, sig_user
      ) values (
                 channel.id, reason, args, originator,

                 _user,

                 now(),
                 case when _sig_user is null then null else now() end,

                 _chainsaw_event_id, _onchain_tx_logical_id,

                 json_not_null(update_obj, 'recipient', 'hex')::csw_eth_address, json_not_null(update_obj, 'balanceWeiHub', 'uint256')::wei_amount, json_not_null(update_obj, 'balanceWeiUser', 'uint256')::wei_amount, json_not_null(update_obj, 'balanceTokenHub', 'uint256')::token_amount, json_not_null(update_obj, 'balanceTokenUser', 'uint256')::token_amount, json_null(update_obj, 'pendingDepositWeiHub', 'uint256')::wei_amount, json_null(update_obj, 'pendingDepositWeiUser', 'uint256')::wei_amount, json_null(update_obj, 'pendingDepositTokenHub', 'uint256')::token_amount, json_null(update_obj, 'pendingDepositTokenUser', 'uint256')::token_amount, json_null(update_obj, 'pendingWithdrawalWeiHub', 'uint256')::wei_amount, json_null(update_obj, 'pendingWithdrawalWeiUser', 'uint256')::wei_amount, json_null(update_obj, 'pendingWithdrawalTokenHub', 'uint256')::token_amount, json_null(update_obj, 'pendingWithdrawalTokenUser', 'uint256')::token_amount, json_not_null(update_obj, 'txCountGlobal', 'uint')::integer, json_not_null(update_obj, 'txCountChain', 'uint')::integer, json_null(update_obj, 'threadRoot', 'hex')::csw_sha3_hash, json_not_null(update_obj, 'threadCount', 'uint')::integer, json_null(update_obj, 'timeout', 'uint')::integer, json_not_null(update_obj, 'sigHub', 'hex')::eth_signature, json_null(update_obj, 'sigUser', 'hex')::eth_signature
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
$$;

CREATE FUNCTION cm_channel_updates_post_insert_update_trigger() RETURNS trigger
LANGUAGE plpgsql
AS $$
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
      recipient = latest_update.recipient, balance_wei_hub = latest_update.balance_wei_hub, balance_wei_user = latest_update.balance_wei_user, balance_token_hub = latest_update.balance_token_hub, balance_token_user = latest_update.balance_token_user, pending_deposit_wei_hub = latest_update.pending_deposit_wei_hub, pending_deposit_wei_user = latest_update.pending_deposit_wei_user, pending_deposit_token_hub = latest_update.pending_deposit_token_hub, pending_deposit_token_user = latest_update.pending_deposit_token_user, pending_withdrawal_wei_hub = latest_update.pending_withdrawal_wei_hub, pending_withdrawal_wei_user = latest_update.pending_withdrawal_wei_user, pending_withdrawal_token_hub = latest_update.pending_withdrawal_token_hub, pending_withdrawal_token_user = latest_update.pending_withdrawal_token_user, tx_count_global = latest_update.tx_count_global, tx_count_chain = latest_update.tx_count_chain, thread_root = latest_update.thread_root, thread_count = latest_update.thread_count, timeout = latest_update.timeout, sig_hub = latest_update.sig_hub, sig_user = latest_update.sig_user
  where id = latest_update.channel_id;

  return NEW;
end;
$$;

CREATE FUNCTION cm_channel_updates_pre_insert_update_trigger() RETURNS trigger
LANGUAGE plpgsql
AS $$
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
$$;

CREATE FUNCTION cm_channels_check_update_trigger() RETURNS trigger
LANGUAGE plpgsql
AS $$
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
$$;

CREATE TABLE _cm_thread_updates (
  id bigint NOT NULL,
  thread_pk bigint,
  created_on timestamp with time zone NOT NULL,
  thread_id integer NOT NULL,
  tx_count integer NOT NULL,
  balance_wei_sender wei_amount NOT NULL,
  balance_wei_receiver wei_amount NOT NULL,
  balance_token_sender token_amount NOT NULL,
  balance_token_receiver token_amount NOT NULL,
  sig_a eth_signature NOT NULL
);

CREATE TABLE _cm_threads (
  id bigint NOT NULL,
  sender csw_eth_address NOT NULL,
  receiver csw_eth_address NOT NULL,
  sender_channel_id bigint NOT NULL,
  receiver_channel_id bigint NOT NULL,
  status cm_thread_status DEFAULT 'CT_CLOSED'::cm_thread_status NOT NULL,
  thread_id integer,
  tx_count integer,
  balance_wei_sender wei_amount,
  balance_wei_receiver wei_amount,
  balance_token_sender token_amount,
  balance_token_receiver token_amount,
  sig_a eth_signature,
  latest_update_id bigint, -- references _cm_thread_updates(id)
  last_updated_on timestamp with time zone,
  sender_open_update_id bigint,
  receiver_open_update_id bigint,
  sender_close_update_id bigint,
  receiver_close_update_id bigint,
  sender_dispute_event_id bigint,
  sender_dispute_ends_on timestamp with time zone,
  receiver_dispute_event_id bigint,
  receiver_dispute_ends_on timestamp with time zone,
  CONSTRAINT _cm_threads_check CHECK (((sender)::citext OPERATOR(<>) (receiver)::citext)),
  CONSTRAINT _cm_threads_check1 CHECK (((sender)::citext OPERATOR(<>) (receiver)::citext)),
  CONSTRAINT _cm_threads_check2 CHECK (
    CASE status
    WHEN 'CT_OPEN'::cm_thread_status THEN (COALESCE(sender_dispute_event_id, receiver_dispute_event_id) IS NULL)
    WHEN 'CT_IN_DISPUTE'::cm_thread_status THEN (COALESCE(sender_dispute_event_id, receiver_dispute_event_id) IS NOT NULL)
    ELSE NULL::boolean
    END)
);

CREATE VIEW cm_threads AS
  SELECT t.id,
         t.sender,
         t.receiver,
         t.sender_channel_id,
         t.receiver_channel_id,
         t.status,
         t.thread_id,
         t.tx_count,
         t.balance_wei_sender,
         t.balance_wei_receiver,
         t.balance_token_sender,
         t.balance_token_receiver,
         t.sig_a,
         t.latest_update_id,
         t.last_updated_on,
         t.sender_open_update_id,
         t.receiver_open_update_id,
         t.sender_close_update_id,
         t.receiver_close_update_id,
         t.sender_dispute_event_id,
         t.sender_dispute_ends_on,
         t.receiver_dispute_event_id,
         t.receiver_dispute_ends_on,
         c.contract
  FROM (_cm_threads t
    JOIN cm_channels c ON ((c.id = t.sender_channel_id)));

CREATE VIEW cm_thread_updates AS
  SELECT tu.id,
         tu.thread_pk,
         tu.created_on,
         t.status AS thread_status,
         t.contract,
         t.status,
         t.sender,
         t.receiver,
         tu.thread_id,
         tu.tx_count,
         tu.balance_wei_sender,
         tu.balance_wei_receiver,
         tu.balance_token_sender,
         tu.balance_token_receiver,
         tu.sig_a
  FROM (_cm_thread_updates tu
    JOIN cm_threads t ON ((t.id = tu.thread_pk)));

CREATE FUNCTION cm_thread_insert_state(_sender_open_update_id bigint, _receiver_open_update_id bigint, _sender_close_update_id bigint, _receiver_close_update_id bigint, update_obj jsonb) RETURNS cm_thread_updates
LANGUAGE plpgsql
AS $$
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
    thread_id, tx_count, balance_wei_sender, balance_wei_receiver, balance_token_sender, balance_token_receiver, sig_a
    ) values (
               _thread.id, now(),
               json_not_null(update_obj, 'threadId', 'uint')::integer, json_not_null(update_obj, 'txCount', 'uint')::integer, json_not_null(update_obj, 'balanceWeiSender', 'uint256')::wei_amount, json_not_null(update_obj, 'balanceWeiReceiver', 'uint256')::wei_amount, json_not_null(update_obj, 'balanceTokenSender', 'uint256')::token_amount, json_not_null(update_obj, 'balanceTokenReceiver', 'uint256')::token_amount, json_not_null(update_obj, 'sigA', 'hex')::eth_signature
               ) returning * into _update_row;

  return (
         select row(tu.*)
         from cm_thread_updates as tu
         where id = _update_row.id
         );
end
$$;

CREATE FUNCTION cm_thread_update_status(_thread_pk bigint, _status cm_thread_status) RETURNS boolean
LANGUAGE plpgsql
AS $$
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
$$;

CREATE FUNCTION cm_thread_updates_post_insert_trigger() RETURNS trigger
LANGUAGE plpgsql
AS $$
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
      thread_id = latest_update.thread_id, tx_count = latest_update.tx_count, balance_wei_sender = latest_update.balance_wei_sender, balance_wei_receiver = latest_update.balance_wei_receiver, balance_token_sender = latest_update.balance_token_sender, balance_token_receiver = latest_update.balance_token_receiver, sig_a = latest_update.sig_a
  where id = latest_update.thread_pk;

  return NEW;
end;
$$;

CREATE FUNCTION cm_threads_check_insert_trigger() RETURNS trigger
LANGUAGE plpgsql
AS $$
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
$$;

CREATE FUNCTION cm_threads_check_update_trigger() RETURNS trigger
LANGUAGE plpgsql
AS $$
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
$$;

CREATE FUNCTION create_withdrawal_usd_amount(_recipient text) RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  _rate fiat_amount;
  _amountwei wei_amount;
  _amountusd fiat_amount;
  _id BIGINT;
  _rate_id BIGINT;
  _now BIGINT;
BEGIN
  -- Return values: -1 if there's no available payment. A numeric ID otherwise.
  SELECT now_millis() INTO _now;

  LOCK TABLE payment IN SHARE ROW EXCLUSIVE MODE;
  IF (SELECT NOT EXISTS(SELECT 1 FROM payments WHERE receiver = _recipient AND withdrawal_id IS NULL)) THEN
    RETURN -1;
  END IF;

  SELECT rate_usd, id INTO _rate, _rate_id FROM applicable_exchange_rate(_now);
  SELECT INTO _amountusd SUM(amountusd) FROM payments WHERE receiver = _recipient AND withdrawal_id IS NULL;
  SELECT fiat_to_wei(_amountusd, _rate) INTO _amountwei;

  INSERT INTO withdrawals(recipient, amountusd, amountwei, exchange_rate_id, status, createdat, method) VALUES (_recipient, _amountusd, _amountwei, _rate_id, 'NEW', _now, 'PEGGED_FIAT') RETURNING id INTO _id;
  UPDATE payment SET withdrawal_id = _id WHERE token in (select token from payments where receiver = _recipient AND withdrawal_id IS NULL);
  RETURN _id;
END;
$$;

CREATE FUNCTION create_withdrawal_wei_amount(_recipient text) RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  _rate fiat_amount;
  _amountwei wei_amount;
  _amountusd fiat_amount;
  _id BIGINT;
  _rate_id BIGINT;
  _now BIGINT;
BEGIN
  -- Return values: -1 if there's no available payment. A numeric ID otherwise.
  SELECT now_millis() INTO _now;

  LOCK TABLE payment IN SHARE ROW EXCLUSIVE MODE;
  IF (SELECT NOT EXISTS(SELECT 1 FROM payments WHERE receiver = _recipient AND withdrawal_id IS NULL)) THEN
    RETURN -1;
  END IF;

  SELECT rate_usd, id INTO _rate, _rate_id FROM applicable_exchange_rate(_now);
  SELECT INTO _amountwei SUM(amountwei) FROM payments WHERE receiver = _recipient AND withdrawal_id IS NULL;
  SELECT wei_to_fiat(_amountwei, _rate) INTO _amountusd;

  INSERT INTO withdrawals(recipient, amountusd, amountwei, exchange_rate_id, status, createdat, method) VALUES (_recipient, _amountusd, _amountwei, _rate_id, 'NEW', _now, 'WEI_SUM') RETURNING id INTO _id;
  UPDATE payment SET withdrawal_id = _id WHERE token in (select token from payments where receiver = _recipient AND withdrawal_id IS NULL);
  RETURN _id;
END;
$$;

CREATE FUNCTION custodial_payments_pre_insert_update_trigger() RETURNS trigger
LANGUAGE plpgsql
AS $$
declare
  payment_recipient csw_eth_address;
  disbursement_user csw_eth_address;
begin
  payment_recipient := (select recipient from _payments where id = NEW.payment_id);
  disbursement_user := (select "user" from _cm_channel_updates where id = NEW.disbursement_id);
  if payment_recipient <> disbursement_user then
    raise exception 'payment_recipient = % is not the same as disbursement_user = %, (custodial_payment = %)',
    payment_recipient,
    disbursement_user,
    NEW;
  end if;

  return NEW;
end;
$$;

CREATE FUNCTION disburesment_stamp_now() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'NEW' THEN
    NEW.createdat := (SELECT floor(extract(epoch from NOW()) * 1000));
  ELSE
    RAISE EXCEPTION 'invalid initial state';
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION fiat_to_wei(amount_usd fiat_amount, exchange_rate numeric) RETURNS numeric
LANGUAGE sql
AS $$
SELECT (amount_usd / exchange_rate * 1e18) AS result
$$;

-- Internal. Normalizes (ensures there is a 0x prefix) and validates a hex string.
CREATE FUNCTION hex_normalize(field text, val text, allow_null boolean DEFAULT false) RETURNS text
LANGUAGE plpgsql IMMUTABLE
AS $$
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
$$;

-- Internal. Extracts ``field`` from ``jsonb obj``,and throws an exception
-- if the result (or any of the input) is null.
CREATE FUNCTION json_not_null(obj jsonb, field text, cast_as text DEFAULT NULL::text) RETURNS text
LANGUAGE plpgsql IMMUTABLE
AS $$
declare
  res text := json_null(obj, field, cast_as);
begin
  if res is null then
    raise exception '% must not be null', field using errcode = 'null_value_not_allowed';
  end if;
  return res;
end
$$;

-- Internal. Extracts ``field`` from ``jsonb obj``, or `null`.
CREATE FUNCTION json_null(obj jsonb, field text, cast_as text DEFAULT NULL::text) RETURNS text
LANGUAGE plpgsql IMMUTABLE
AS $_$
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
$_$;

CREATE FUNCTION materialize_chainsaw_channel() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.event_type = 'DidOpen' THEN
    INSERT INTO chainsaw_channels (contract, channel_id, wei_value, opened_event_id, status)
    VALUES (NEW.contract, NEW.channel_id, CAST(NEW.fields->>'value' AS wei_amount), NEW.id, 'CS_OPEN');
  END IF;

  IF NEW.event_type = 'DidDeposit' THEN
    UPDATE chainsaw_channels SET wei_value = wei_value + CAST(NEW.fields->>'value' AS wei_amount)
    WHERE channel_id = NEW.channel_id;
    INSERT INTO chainsaw_channels_deposits (channel_id, deposit_event_id)
    VALUES (NEW.channel_id, NEW.id);
  END IF;

  IF NEW.event_type = 'DidClaim' THEN
    UPDATE chainsaw_channels SET (claim_event_id, status) = (NEW.id, 'CS_SETTLED')
    WHERE channel_id = NEW.channel_id;
  END IF;

  IF NEW.event_type = 'DidStartSettling' THEN
    UPDATE chainsaw_channels SET (start_settling_event_id, status) = (NEW.id, 'CS_SETTLING')
    WHERE channel_id = NEW.channel_id;
  END IF;

  IF NEW.event_type = 'DidSettle' THEN
    UPDATE chainsaw_channels SET (settled_event_id, status) = (NEW.id, 'CS_SETTLED')
    WHERE channel_id = NEW.channel_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION materialize_chainsaw_ledger_channel() RETURNS trigger
LANGUAGE plpgsql
AS $$
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
$$;

CREATE FUNCTION ts_to_millis(ts timestamp with time zone) RETURNS bigint
LANGUAGE sql IMMUTABLE
AS $$
SELECT FLOOR(EXTRACT(EPOCH FROM ts) * 1000)::BIGINT AS result;
$$;

CREATE FUNCTION now_millis() RETURNS bigint
LANGUAGE sql
AS $$
SELECT ts_to_millis(NOW()) AS result;
$$;

CREATE FUNCTION stamp_exchange_rate() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.exchange_rate_id := (SELECT id FROM applicable_exchange_rate(now_millis()));
  RETURN NEW;
END;
$$;

CREATE FUNCTION validate_disbursement_status() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'PENDING' THEN
    IF OLD.status != 'NEW' THEN
      RAISE EXCEPTION 'invalid state transition';
    END IF;

    NEW.pendingat := (SELECT floor(extract(epoch from NOW()) * 1000));
  END IF;

  IF NEW.status = 'CONFIRMED' THEN
    IF OLD.status != 'PENDING' THEN
      RAISE EXCEPTION 'invalid state transition';
    END IF;

    NEW.confirmedat := (SELECT floor(extract(epoch from NOW()) * 1000));
  END IF;

  IF NEW.status = 'FAILED' THEN
    IF OLD.status != 'PENDING' AND OLD.status != 'NEW' THEN
      RAISE EXCEPTION 'invalid state transition';
    END IF;

    NEW.failedat := (SELECT floor(extract(epoch from NOW()) * 1000));
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION validate_status() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'PENDING' THEN
    IF OLD.status != 'NEW' THEN
      RAISE EXCEPTION 'invalid state transition';
    END IF;

    NEW.pendingat := (SELECT floor(extract(epoch from NOW()) * 1000));
  END IF;

  IF NEW.status = 'CONFIRMED' THEN
    IF OLD.status != 'PENDING' THEN
      RAISE EXCEPTION 'invalid state transition';
    END IF;

    NEW.confirmedat := (SELECT floor(extract(epoch from NOW()) * 1000));
  END IF;

  IF NEW.status = 'FAILED' THEN
    IF OLD.status != 'PENDING' AND OLD.status != 'NEW' THEN
      RAISE EXCEPTION 'invalid state transition';
    END IF;

    NEW.failedat := (SELECT floor(extract(epoch from NOW()) * 1000));
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION wei_to_fiat(amount_wei wei_amount, exchange_rate numeric) RETURNS numeric
LANGUAGE sql
AS $$
SELECT (amount_wei * exchange_rate * 1e-18) AS result
$$;

CREATE SEQUENCE _cm_channel_updates_id_seq
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;


CREATE SEQUENCE _cm_channels_id_seq
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;


CREATE SEQUENCE _cm_thread_updates_id_seq
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;


-- Note: to help avoid potential bugs from queries which incorrectly use:
--   join cm_threads on cm_threads.id = cm_thread_updates.thread_id
-- Instead of:
--   join cm_threads on cm_threads.id = cm_thread_updates.thread_pk
-- Start the cm_threads.id sequence at 1,000,000 so it's very unlikely that
-- there will ever be a situation where a `cm_thread_updates.thread_id` will
-- also be a valid `cm_threads.id`.
CREATE SEQUENCE _cm_threads_id_seq
  START WITH 1000000
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;


CREATE TABLE _payments (
  id bigint NOT NULL,
  purchase_id character varying(64) NOT NULL,
  recipient csw_eth_address NOT NULL,
  channel_update_id bigint,
  thread_update_id bigint,
  amount_wei wei_amount NOT NULL,
  amount_token token_amount NOT NULL,
  meta jsonb NOT NULL,
  CONSTRAINT _payments_check CHECK ((((channel_update_id IS NULL) AND (thread_update_id IS NOT NULL)) OR ((channel_update_id IS NOT NULL) AND (thread_update_id IS NULL))))
);

CREATE SEQUENCE _payments_id_seq
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;


CREATE TABLE chainsaw_channel_events (
  id bigint NOT NULL,
  contract csw_eth_address NOT NULL,
  channel_id csw_sha3_hash NOT NULL,
  ts bigint NOT NULL,
  block_number integer NOT NULL,
  block_hash csw_sha3_hash NOT NULL,
  is_valid_block boolean NOT NULL,
  sender csw_eth_address NOT NULL,
  event_type csw_channel_event_type NOT NULL,
  fields jsonb
);

CREATE SEQUENCE chainsaw_channel_events_id_seq
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;


CREATE TABLE chainsaw_channels (
  id bigint NOT NULL,
  contract csw_eth_address NOT NULL,
  channel_id csw_sha3_hash NOT NULL,
  wei_value wei_amount NOT NULL,
  status csw_channel_state NOT NULL,
  opened_event_id bigint,
  start_settling_event_id bigint,
  settled_event_id bigint,
  claim_event_id bigint
);

CREATE TABLE chainsaw_channels_deposits (
  channel_id csw_sha3_hash,
  deposit_event_id bigint
);

CREATE SEQUENCE chainsaw_channels_id_seq
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;


CREATE SEQUENCE chainsaw_events_id_seq
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;


CREATE TABLE chainsaw_ledger_channels (
  id bigint NOT NULL,
  contract csw_eth_address NOT NULL,
  channel_id csw_sha3_hash NOT NULL,
  wei_balance_a_chain wei_amount NOT NULL,
  wei_balance_i_chain wei_amount NOT NULL,
  on_chain_nonce bigint NOT NULL,
  vc_root_hash csw_sha3_hash NOT NULL,
  num_open_vc bigint NOT NULL,
  status csw_ledger_channel_state NOT NULL,
  update_timeout bigint,
  lc_opened_event_id bigint,
  lc_joined_event_id bigint,
  lc_start_settling_event_id bigint,
  lc_closed_event_id bigint,
  open_timeout bigint,
  erc20_balance_a_chain wei_amount NOT NULL,
  erc20_balance_i_chain wei_amount NOT NULL,
  token csw_eth_address NOT NULL
);

CREATE TABLE chainsaw_ledger_channels_deposits (
  channel_id csw_sha3_hash,
  deposit_event_id bigint,
  ledger_channel_state_updates_id bigint
);

CREATE SEQUENCE chainsaw_ledger_channels_id_seq
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;


CREATE TABLE chainsaw_poll_events (
  block_number bigint NOT NULL,
  polled_at bigint NOT NULL,
  contract csw_eth_address NOT NULL,
  poll_type character varying DEFAULT 'FETCH_EVENTS'::character varying NOT NULL,
  tx_idx integer
);

CREATE TABLE custodial_payments (
  id bigint NOT NULL,
  payment_id bigint NOT NULL,
  disbursement_id bigint NOT NULL
);

CREATE SEQUENCE custodial_payments_id_seq
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;


CREATE TABLE disbursements (
  id bigint NOT NULL,
  recipient character varying NOT NULL,
  amountwei wei_amount,
  txhash character varying,
  status disbursements_status NOT NULL,
  createdat bigint NOT NULL,
  pendingat bigint,
  confirmedat bigint,
  failedat bigint,
  amounterc20 wei_amount
);

CREATE SEQUENCE disbursements_id_seq
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;


CREATE TABLE exchange_rates (
  id bigint NOT NULL,
  retrievedat bigint,
  base character varying,
  rate_usd numeric(78,2)
);

CREATE SEQUENCE exchange_rates_id_seq
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;


CREATE TABLE feature_flags (
  address csw_eth_address NOT NULL,
  booty_support boolean DEFAULT false NOT NULL
);

CREATE TABLE gas_estimates (
  id bigint NOT NULL,
  retrieved_at bigint,
  speed double precision,
  block_num bigint,
  block_time double precision,
  fastest double precision,
  fastest_wait double precision,
  fast double precision,
  fast_wait double precision,
  average double precision,
  avg_wait double precision,
  safe_low double precision,
  safe_low_wait double precision
);

CREATE SEQUENCE gas_estimates_id_seq
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;


CREATE TABLE global_settings (
  withdrawals_enabled boolean DEFAULT true NOT NULL,
  payments_enabled boolean DEFAULT true NOT NULL,
  threads_enabled boolean DEFAULT false
);

CREATE TABLE ledger_channel_state_updates (
  id bigint NOT NULL,
  is_close smallint NOT NULL,
  channel_id csw_sha3_hash,
  nonce bigint NOT NULL,
  open_vcs integer NOT NULL,
  vc_root_hash csw_sha3_hash NOT NULL,
  wei_balance_a wei_amount NOT NULL,
  wei_balance_i wei_amount NOT NULL,
  reason ledger_channel_state_update_reason,
  vc_id csw_sha3_hash,
  sig_a eth_signature,
  sig_i eth_signature,
  exchange_rate_id bigint NOT NULL,
  price_wei wei_amount,
  erc20_balance_a wei_amount NOT NULL,
  erc20_balance_i wei_amount NOT NULL,
  created_at bigint NOT NULL,
  price_erc20 token_amount
);

CREATE VIEW hub_ledger_channels AS
  WITH lcs AS (
    SELECT csw.id,
           csw.contract,
           csw.channel_id,
           coe.sender AS party_a,
           ((coe.fields ->> 'partyI'::text))::csw_eth_address AS party_i,
           COALESCE(lcsu.wei_balance_a, csw.wei_balance_a_chain) AS wei_balance_a,
           COALESCE(lcsu.wei_balance_i, csw.wei_balance_i_chain) AS wei_balance_i,
           csw.token,
           COALESCE(lcsu.erc20_balance_a, csw.erc20_balance_a_chain) AS erc20_balance_a,
           COALESCE(lcsu.erc20_balance_i, csw.erc20_balance_i_chain) AS erc20_balance_i,
           csw.wei_balance_a_chain,
           csw.wei_balance_i_chain,
           COALESCE(lcsu.nonce, (0)::bigint) AS nonce,
           COALESCE(lcsu.open_vcs, 0) AS open_vcs,
           COALESCE(lcsu.vc_root_hash, csw.vc_root_hash) AS vc_root_hash,
           csw.status,
           csw.lc_opened_event_id,
           csw.lc_joined_event_id,
           csw.lc_start_settling_event_id,
           csw.lc_closed_event_id
    FROM ((chainsaw_ledger_channels csw
      LEFT JOIN chainsaw_channel_events coe ON ((coe.id = csw.lc_opened_event_id)))
      LEFT JOIN ledger_channel_state_updates lcsu ON (((lcsu.channel_id)::citext OPERATOR(=) (csw.channel_id)::citext)))
  )
  SELECT t1.id,
         t1.contract,
         t1.channel_id,
         t1.party_a,
         t1.party_i,
         t1.wei_balance_a,
         t1.wei_balance_i,
         t1.token,
         t1.erc20_balance_a,
         t1.erc20_balance_i,
         t1.wei_balance_a_chain,
         t1.wei_balance_i_chain,
         t1.nonce,
         t1.open_vcs,
         t1.vc_root_hash,
         t1.status,
         t1.lc_opened_event_id,
         t1.lc_joined_event_id,
         t1.lc_start_settling_event_id,
         t1.lc_closed_event_id
  FROM (lcs t1
    LEFT JOIN lcs t2 ON (((t1.id = t2.id) AND (t1.nonce < t2.nonce))))
  WHERE (t2.nonce IS NULL)
  ORDER BY t1.nonce DESC;

CREATE TABLE virtual_channel_state_updates (
  id bigint NOT NULL,
  channel_id csw_sha3_hash,
  nonce bigint NOT NULL,
  wei_balance_a wei_amount NOT NULL,
  wei_balance_b wei_amount NOT NULL,
  sig_a eth_signature,
  sig_b eth_signature,
  exchange_rate_id bigint NOT NULL,
  price_wei wei_amount NOT NULL,
  erc20_balance_a wei_amount NOT NULL,
  erc20_balance_b wei_amount NOT NULL,
  created_at bigint,
  price_erc20 token_amount
);

CREATE TABLE virtual_channels (
  id bigint NOT NULL,
  channel_id csw_sha3_hash NOT NULL,
  party_a csw_eth_address NOT NULL,
  party_b csw_eth_address NOT NULL,
  party_i csw_eth_address NOT NULL,
  subchan_a_to_i csw_sha3_hash,
  subchan_b_to_i csw_sha3_hash,
  status csw_virtual_channel_state NOT NULL,
  on_chain_nonce bigint,
  update_timeout bigint,
  vc_init_event_id bigint,
  vc_start_settling_event_id bigint,
  vc_settled_event_id bigint
);

CREATE VIEW hub_virtual_channels AS
  WITH vcs AS (
    SELECT vc.id,
           vc.channel_id,
           vc.party_a,
           vc.party_b,
           vc.party_i,
           vc.subchan_a_to_i,
           vc.subchan_b_to_i,
           COALESCE((vcsu.wei_balance_a)::numeric, (0)::numeric) AS wei_balance_a,
           COALESCE((vcsu.wei_balance_b)::numeric, (0)::numeric) AS wei_balance_b,
           COALESCE((vcsu.erc20_balance_a)::numeric, (0)::numeric) AS erc20_balance_a,
           COALESCE((vcsu.erc20_balance_b)::numeric, (0)::numeric) AS erc20_balance_b,
           COALESCE(vcsu.nonce, (0)::bigint) AS nonce,
           vc.status
    FROM (virtual_channels vc
      JOIN virtual_channel_state_updates vcsu ON (((vcsu.channel_id)::citext OPERATOR(=) (vc.channel_id)::citext)))
  )
  SELECT t1.id,
         t1.channel_id,
         t1.party_a,
         t1.party_b,
         t1.party_i,
         t1.subchan_a_to_i,
         t1.subchan_b_to_i,
         t1.wei_balance_a,
         t1.wei_balance_b,
         t1.erc20_balance_a,
         t1.erc20_balance_b,
         t1.nonce,
         t1.status
  FROM (vcs t1
    LEFT JOIN vcs t2 ON (((t1.id = t2.id) AND (t1.nonce < t2.nonce))))
  WHERE (t2.nonce IS NULL)
  ORDER BY t1.nonce DESC;

CREATE SEQUENCE ledger_channel_state_updates_id_seq
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;


CREATE TABLE onchain_transactions_raw (
  id bigint NOT NULL,
  logical_id bigint NOT NULL,
  state onchain_transaction_state DEFAULT 'new'::onchain_transaction_state NOT NULL,
  "from" csw_eth_address NOT NULL,
  "to" csw_eth_address NOT NULL,
  value wei_amount NOT NULL,
  gas bigint NOT NULL,
  gas_price bigint NOT NULL,
  data text NOT NULL,
  nonce bigint NOT NULL,
  signature jsonb,
  hash csw_sha3_hash,
  meta jsonb NOT NULL,
  created_on timestamp with time zone DEFAULT now() NOT NULL,
  submitted_on timestamp with time zone,
  confirmed_on timestamp with time zone,
  block_num integer,
  block_hash csw_sha3_hash,
  transaction_index integer,
  failed_on timestamp with time zone,
  failed_reason text
);

CREATE SEQUENCE onchain_transactions_raw_id_seq
  START WITH 10000000
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

-- The sequence that will be used for the logical IDs
CREATE SEQUENCE onchain_transactions_raw_logical_id_seq
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

CREATE TABLE payment_meta (
  receiver character varying NOT NULL,
  type character varying NOT NULL,
  fields jsonb,
  vcupdatetoken bigint,
  lcupdatetoken bigint,
  purchase character varying(128) NOT NULL,
  CONSTRAINT valid_receiver CHECK (((receiver)::text ~* '^0x[a-fA-F0-9]{40}$'::text))
);

CREATE VIEW payments AS
  SELECT p.id,
         up.created_on,
         up.contract,
         p.purchase_id,
         up."user" AS sender,
         p.recipient,
         p.amount_wei,
         p.amount_token,
         p.meta,
         'PT_CHANNEL'::text AS payment_type,
         up.recipient AS custodian_address
  FROM (_payments p
    JOIN cm_channel_updates up ON ((up.id = p.channel_update_id)))
  UNION ALL
  SELECT p.id,
         up.created_on,
         up.contract,
         p.purchase_id,
         up.sender,
         p.recipient,
         p.amount_wei,
         p.amount_token,
         p.meta,
         'PT_THREAD'::text AS payment_type,
         NULL::citext AS custodian_address
  FROM (_payments p
    JOIN cm_thread_updates up ON ((up.id = p.thread_update_id)));

CREATE SEQUENCE virtual_channel_state_updates_id_seq
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;


CREATE SEQUENCE virtual_channels_id_seq
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;


CREATE TABLE withdrawals (
  id bigint NOT NULL,
  recipient character varying NOT NULL,
  amountwei wei_amount,
  amountusd fiat_amount,
  txhash character varying,
  status withdrawal_status NOT NULL,
  exchange_rate_id bigint NOT NULL,
  createdat bigint NOT NULL,
  pendingat bigint,
  confirmedat bigint,
  failedat bigint,
  method calculation_method NOT NULL,
  initiator character varying NOT NULL
);

CREATE SEQUENCE withdrawals_id_seq
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;


ALTER TABLE ONLY _cm_channel_updates ALTER COLUMN id SET DEFAULT nextval('_cm_channel_updates_id_seq'::regclass);

ALTER TABLE ONLY _cm_channels ALTER COLUMN id SET DEFAULT nextval('_cm_channels_id_seq'::regclass);

ALTER TABLE ONLY _cm_thread_updates ALTER COLUMN id SET DEFAULT nextval('_cm_thread_updates_id_seq'::regclass);

ALTER TABLE ONLY _cm_threads ALTER COLUMN id SET DEFAULT nextval('_cm_threads_id_seq'::regclass);

ALTER TABLE ONLY _payments ALTER COLUMN id SET DEFAULT nextval('_payments_id_seq'::regclass);

ALTER TABLE ONLY chainsaw_channel_events ALTER COLUMN id SET DEFAULT nextval('chainsaw_channel_events_id_seq'::regclass);

ALTER TABLE ONLY chainsaw_channels ALTER COLUMN id SET DEFAULT nextval('chainsaw_channels_id_seq'::regclass);

ALTER TABLE ONLY chainsaw_events ALTER COLUMN id SET DEFAULT nextval('chainsaw_events_id_seq'::regclass);

ALTER TABLE ONLY chainsaw_ledger_channels ALTER COLUMN id SET DEFAULT nextval('chainsaw_ledger_channels_id_seq'::regclass);

ALTER TABLE ONLY custodial_payments ALTER COLUMN id SET DEFAULT nextval('custodial_payments_id_seq'::regclass);

ALTER TABLE ONLY disbursements ALTER COLUMN id SET DEFAULT nextval('disbursements_id_seq'::regclass);

ALTER TABLE ONLY exchange_rates ALTER COLUMN id SET DEFAULT nextval('exchange_rates_id_seq'::regclass);

ALTER TABLE ONLY gas_estimates ALTER COLUMN id SET DEFAULT nextval('gas_estimates_id_seq'::regclass);

ALTER TABLE ONLY ledger_channel_state_updates ALTER COLUMN id SET DEFAULT nextval('ledger_channel_state_updates_id_seq'::regclass);

ALTER TABLE ONLY onchain_transactions_raw ALTER COLUMN id SET DEFAULT nextval('onchain_transactions_raw_id_seq'::regclass);

ALTER TABLE ONLY virtual_channel_state_updates ALTER COLUMN id SET DEFAULT nextval('virtual_channel_state_updates_id_seq'::regclass);

ALTER TABLE ONLY virtual_channels ALTER COLUMN id SET DEFAULT nextval('virtual_channels_id_seq'::regclass);

ALTER TABLE ONLY withdrawals ALTER COLUMN id SET DEFAULT nextval('withdrawals_id_seq'::regclass);

SELECT pg_catalog.setval('_cm_channel_updates_id_seq', 1, false);

SELECT pg_catalog.setval('_cm_channels_id_seq', 1, false);

SELECT pg_catalog.setval('_cm_thread_updates_id_seq', 1, false);

SELECT pg_catalog.setval('_cm_threads_id_seq', 1, false);

SELECT pg_catalog.setval('_payments_id_seq', 1, false);

SELECT pg_catalog.setval('chainsaw_channel_events_id_seq', 1, false);

SELECT pg_catalog.setval('chainsaw_channels_id_seq', 1, false);

SELECT pg_catalog.setval('chainsaw_events_id_seq', 1, false);

SELECT pg_catalog.setval('chainsaw_ledger_channels_id_seq', 1, false);

SELECT pg_catalog.setval('custodial_payments_id_seq', 1, false);

SELECT pg_catalog.setval('disbursements_id_seq', 1, false);

SELECT pg_catalog.setval('exchange_rates_id_seq', 1, false);

INSERT INTO feature_flags (address, booty_support) VALUES('0x0000000000000000000000000000000000000000', false);

SELECT pg_catalog.setval('gas_estimates_id_seq', 1, false);

INSERT INTO global_settings (withdrawals_enabled, payments_enabled, threads_enabled) VALUES(TRUE, TRUE, FALSE);

SELECT pg_catalog.setval('ledger_channel_state_updates_id_seq', 1, false);

SELECT pg_catalog.setval('onchain_transactions_raw_id_seq', 1, false);

SELECT pg_catalog.setval('onchain_transactions_raw_logical_id_seq', 1, false);

SELECT pg_catalog.setval('virtual_channel_state_updates_id_seq', 1, false);

SELECT pg_catalog.setval('virtual_channels_id_seq', 1, false);

SELECT pg_catalog.setval('withdrawals_id_seq', 1, false);

ALTER TABLE ONLY _cm_channel_updates
  ADD CONSTRAINT _cm_channel_updates_pkey PRIMARY KEY (id);

ALTER TABLE ONLY _cm_channels
  ADD CONSTRAINT _cm_channels_pkey PRIMARY KEY (id);

ALTER TABLE ONLY _cm_thread_updates
  ADD CONSTRAINT _cm_thread_updates_pkey PRIMARY KEY (id);

ALTER TABLE ONLY _cm_threads
  ADD CONSTRAINT _cm_threads_pkey PRIMARY KEY (id);

ALTER TABLE ONLY _payments
  ADD CONSTRAINT _payments_channel_update_id_key UNIQUE (channel_update_id);

ALTER TABLE ONLY _payments
  ADD CONSTRAINT _payments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY _payments
  ADD CONSTRAINT _payments_thread_update_id_key UNIQUE (thread_update_id);

ALTER TABLE ONLY chainsaw_channel_events
  ADD CONSTRAINT chainsaw_channel_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY chainsaw_channels
  ADD CONSTRAINT chainsaw_channels_channel_id_key UNIQUE (channel_id);

ALTER TABLE ONLY chainsaw_channels
  ADD CONSTRAINT chainsaw_channels_pkey PRIMARY KEY (id);

ALTER TABLE ONLY chainsaw_events
  ADD CONSTRAINT chainsaw_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY chainsaw_ledger_channels
  ADD CONSTRAINT chainsaw_ledger_channels_channel_id_key UNIQUE (channel_id);

ALTER TABLE ONLY chainsaw_ledger_channels
  ADD CONSTRAINT chainsaw_ledger_channels_pkey PRIMARY KEY (id);

ALTER TABLE ONLY chainsaw_poll_events
  ADD CONSTRAINT chainsaw_poll_events_block_number_tx_id_unique UNIQUE (block_number, tx_idx);

ALTER TABLE ONLY custodial_payments
  ADD CONSTRAINT custodial_payments_disbursement_id_key UNIQUE (disbursement_id);

ALTER TABLE ONLY custodial_payments
  ADD CONSTRAINT custodial_payments_payment_id_key UNIQUE (payment_id);

ALTER TABLE ONLY custodial_payments
  ADD CONSTRAINT custodial_payments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY disbursements
  ADD CONSTRAINT disbursements_pkey PRIMARY KEY (id);

ALTER TABLE ONLY exchange_rates
  ADD CONSTRAINT exchange_rates_pkey PRIMARY KEY (id);

ALTER TABLE ONLY gas_estimates
  ADD CONSTRAINT gas_estimates_block_num_key UNIQUE (block_num);

ALTER TABLE ONLY gas_estimates
  ADD CONSTRAINT gas_estimates_pkey PRIMARY KEY (id);

ALTER TABLE ONLY ledger_channel_state_updates
  ADD CONSTRAINT ledger_channel_state_updates_channel_id_nonce_key UNIQUE (channel_id, nonce);

ALTER TABLE ONLY ledger_channel_state_updates
  ADD CONSTRAINT ledger_channel_state_updates_pkey PRIMARY KEY (id);

ALTER TABLE ONLY onchain_transactions_raw
  ADD CONSTRAINT onchain_transactions_raw_hash_key UNIQUE (hash);

ALTER TABLE ONLY onchain_transactions_raw
  ADD CONSTRAINT onchain_transactions_raw_pkey PRIMARY KEY (id);

ALTER TABLE ONLY virtual_channel_state_updates
  ADD CONSTRAINT virtual_channel_state_updates_channel_id_nonce_key UNIQUE (channel_id, nonce);

ALTER TABLE ONLY virtual_channel_state_updates
  ADD CONSTRAINT virtual_channel_state_updates_pkey PRIMARY KEY (id);

ALTER TABLE ONLY virtual_channels
  ADD CONSTRAINT virtual_channels_channel_id_key UNIQUE (channel_id);

ALTER TABLE ONLY virtual_channels
  ADD CONSTRAINT virtual_channels_pkey PRIMARY KEY (id);

ALTER TABLE ONLY withdrawals
  ADD CONSTRAINT withdrawals_pkey PRIMARY KEY (id);

-- No two chainsaw events should ever have the same (tx_hash, log_index)
CREATE UNIQUE INDEX chainsaw_events_tx_hash_log_index ON chainsaw_events USING btree (tx_hash, log_index);

CREATE UNIQUE INDEX cm_channel_updates_channel_txcount_unique ON _cm_channel_updates USING btree (channel_id, tx_count_global) WHERE (invalid IS NULL);

CREATE UNIQUE INDEX cm_channels_contract_user ON _cm_channels USING btree (contract, "user");

CREATE UNIQUE INDEX cm_thread_updates_thread_txcount_unique ON _cm_thread_updates USING btree (thread_pk, thread_id, tx_count);

CREATE INDEX cm_threads_receiver ON _cm_threads USING btree (receiver);

-- TODO:
-- - constraint to check that a thread is opened each time an OpenThread state is inserted
-- - same for CloseThread
-- - check that the contract for (sender_channel_id, receiver_channel_id) matches
CREATE INDEX cm_threads_sender ON _cm_threads USING btree (sender);

CREATE UNIQUE INDEX cm_threads_sender_receiver ON _cm_threads USING btree (sender_channel_id, receiver_channel_id) WHERE (status <> 'CT_CLOSED'::cm_thread_status);

CREATE INDEX disbursements_recipient ON disbursements USING btree (recipient);

CREATE UNIQUE INDEX feature_flags_address ON feature_flags USING btree (address);

CREATE INDEX ledger_channel_state_updates_exchange_rate_idx ON ledger_channel_state_updates USING btree (exchange_rate_id);

CREATE INDEX ledger_channel_state_updates_nonce_idx ON ledger_channel_state_updates USING btree (nonce);

CREATE UNIQUE INDEX onchain_transactions_raw_logical_id_unique ON onchain_transactions_raw USING btree (logical_id) WHERE (state <> 'failed'::onchain_transaction_state);

CREATE UNIQUE INDEX payment_meta_lcupdatetoken ON payment_meta USING btree (lcupdatetoken);

CREATE INDEX payment_meta_purchase ON payment_meta USING btree (purchase);

CREATE UNIQUE INDEX payment_meta_vcupdatetoken ON payment_meta USING btree (vcupdatetoken);

CREATE INDEX payments_purchase_id ON _payments USING btree (purchase_id);

CREATE INDEX payments_recipient ON _payments USING btree (recipient);

CREATE UNIQUE INDEX require_single_pending ON withdrawals USING btree (recipient) WHERE ((status = 'NEW'::withdrawal_status) OR (status = 'PENDING'::withdrawal_status));

CREATE UNIQUE INDEX require_single_pending_disbursement ON disbursements USING btree (recipient) WHERE ((status = 'NEW'::disbursements_status) OR (status = 'PENDING'::disbursements_status));

CREATE INDEX virtual_channel_state_updates_channel_id ON virtual_channel_state_updates USING btree (channel_id);

CREATE INDEX virtual_channel_state_updates_exchange_rate_idx ON virtual_channel_state_updates USING btree (exchange_rate_id);

CREATE INDEX virtual_channel_state_updates_nonce_idx ON virtual_channel_state_updates USING btree (nonce);

CREATE INDEX virtual_channels_channel_id ON virtual_channels USING btree (channel_id);

CREATE INDEX virtual_channels_party_a ON virtual_channels USING btree (party_a);

CREATE INDEX virtual_channels_party_b ON virtual_channels USING btree (party_b);

CREATE INDEX virtual_channels_party_i ON virtual_channels USING btree (party_i);

CREATE INDEX withdrawals_recipient ON withdrawals USING btree (recipient);

CREATE TRIGGER cm_channel_updates_post_insert_update_trigger AFTER INSERT OR UPDATE ON _cm_channel_updates FOR EACH ROW EXECUTE PROCEDURE cm_channel_updates_post_insert_update_trigger();

CREATE TRIGGER cm_channel_updates_pre_insert_update_trigger BEFORE INSERT OR UPDATE ON _cm_channel_updates FOR EACH ROW EXECUTE PROCEDURE cm_channel_updates_pre_insert_update_trigger();

CREATE TRIGGER cm_channels_check_update_trigger BEFORE UPDATE ON _cm_channels FOR EACH ROW EXECUTE PROCEDURE cm_channels_check_update_trigger();

CREATE TRIGGER cm_thread_updates_post_insert_trigger AFTER INSERT OR UPDATE ON _cm_thread_updates FOR EACH ROW EXECUTE PROCEDURE cm_thread_updates_post_insert_trigger();

CREATE TRIGGER cm_threads_check_insert_trigger BEFORE INSERT ON _cm_threads FOR EACH ROW EXECUTE PROCEDURE cm_threads_check_insert_trigger();

CREATE TRIGGER cm_threads_check_update_trigger BEFORE UPDATE ON _cm_threads FOR EACH ROW EXECUTE PROCEDURE cm_threads_check_update_trigger();

CREATE TRIGGER custodial_payments_pre_insert_update_trigger BEFORE INSERT OR UPDATE ON custodial_payments FOR EACH ROW EXECUTE PROCEDURE custodial_payments_pre_insert_update_trigger();

CREATE TRIGGER materialize_chainsaw_channel AFTER INSERT ON chainsaw_channel_events FOR EACH ROW EXECUTE PROCEDURE materialize_chainsaw_channel();

CREATE TRIGGER materialize_chainsaw_ledger_channel AFTER INSERT ON chainsaw_channel_events FOR EACH ROW EXECUTE PROCEDURE materialize_chainsaw_ledger_channel();

CREATE TRIGGER stamp_exchange_rate BEFORE INSERT ON virtual_channel_state_updates FOR EACH ROW EXECUTE PROCEDURE stamp_exchange_rate();

CREATE TRIGGER stamp_exchange_rate BEFORE INSERT ON ledger_channel_state_updates FOR EACH ROW EXECUTE PROCEDURE stamp_exchange_rate();

CREATE TRIGGER stamp_now BEFORE INSERT ON disbursements FOR EACH ROW EXECUTE PROCEDURE disburesment_stamp_now();

CREATE TRIGGER validate_status BEFORE UPDATE ON withdrawals FOR EACH ROW EXECUTE PROCEDURE validate_status();

CREATE TRIGGER validate_status BEFORE UPDATE ON disbursements FOR EACH ROW EXECUTE PROCEDURE validate_disbursement_status();

ALTER TABLE ONLY _cm_channel_updates
  ADD CONSTRAINT _cm_channel_updates_chainsaw_event_id_fkey FOREIGN KEY (chainsaw_event_id) REFERENCES chainsaw_events(id);

ALTER TABLE ONLY _cm_channel_updates
  ADD CONSTRAINT _cm_channel_updates_chainsaw_resolution_event_id_fkey FOREIGN KEY (chainsaw_resolution_event_id) REFERENCES chainsaw_events(id);

ALTER TABLE ONLY _cm_channel_updates
  ADD CONSTRAINT _cm_channel_updates_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES _cm_channels(id) DEFERRABLE;

ALTER TABLE ONLY _cm_channels
  ADD CONSTRAINT _cm_channels_channel_dispute_event_id_fkey FOREIGN KEY (channel_dispute_event_id) REFERENCES chainsaw_events(id);

ALTER TABLE ONLY _cm_channels
  ADD CONSTRAINT _cm_channels_thread_dispute_event_id_fkey FOREIGN KEY (thread_dispute_event_id) REFERENCES chainsaw_events(id);

ALTER TABLE ONLY _cm_thread_updates
  ADD CONSTRAINT _cm_thread_updates_thread_pk_fkey FOREIGN KEY (thread_pk) REFERENCES _cm_threads(id);

ALTER TABLE ONLY _cm_threads
  ADD CONSTRAINT _cm_threads_receiver_channel_id_fkey FOREIGN KEY (receiver_channel_id) REFERENCES _cm_channels(id);

ALTER TABLE ONLY _cm_threads
  ADD CONSTRAINT _cm_threads_receiver_close_update_id_fkey FOREIGN KEY (receiver_close_update_id) REFERENCES _cm_channel_updates(id);

ALTER TABLE ONLY _cm_threads
  ADD CONSTRAINT _cm_threads_receiver_dispute_event_id_fkey FOREIGN KEY (receiver_dispute_event_id) REFERENCES chainsaw_events(id);

ALTER TABLE ONLY _cm_threads
  ADD CONSTRAINT _cm_threads_receiver_open_update_id_fkey FOREIGN KEY (receiver_open_update_id) REFERENCES _cm_channel_updates(id);

ALTER TABLE ONLY _cm_threads
  ADD CONSTRAINT _cm_threads_sender_channel_id_fkey FOREIGN KEY (sender_channel_id) REFERENCES _cm_channels(id);

ALTER TABLE ONLY _cm_threads
  ADD CONSTRAINT _cm_threads_sender_close_update_id_fkey FOREIGN KEY (sender_close_update_id) REFERENCES _cm_channel_updates(id);

ALTER TABLE ONLY _cm_threads
  ADD CONSTRAINT _cm_threads_sender_dispute_event_id_fkey FOREIGN KEY (sender_dispute_event_id) REFERENCES chainsaw_events(id);

ALTER TABLE ONLY _cm_threads
  ADD CONSTRAINT _cm_threads_sender_open_update_id_fkey FOREIGN KEY (sender_open_update_id) REFERENCES _cm_channel_updates(id);

ALTER TABLE ONLY _payments
  ADD CONSTRAINT _payments_channel_update_id_fkey FOREIGN KEY (channel_update_id) REFERENCES _cm_channel_updates(id);

ALTER TABLE ONLY _payments
  ADD CONSTRAINT _payments_thread_update_id_fkey FOREIGN KEY (thread_update_id) REFERENCES _cm_thread_updates(id);

ALTER TABLE ONLY chainsaw_channels
  ADD CONSTRAINT chainsaw_channels_claim_event_id_fkey FOREIGN KEY (claim_event_id) REFERENCES chainsaw_channel_events(id);

ALTER TABLE ONLY chainsaw_channels_deposits
  ADD CONSTRAINT chainsaw_channels_deposits_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES chainsaw_channels(channel_id);

ALTER TABLE ONLY chainsaw_channels_deposits
  ADD CONSTRAINT chainsaw_channels_deposits_deposit_event_id_fkey FOREIGN KEY (deposit_event_id) REFERENCES chainsaw_channel_events(id);

ALTER TABLE ONLY chainsaw_channels
  ADD CONSTRAINT chainsaw_channels_opened_event_id_fkey FOREIGN KEY (opened_event_id) REFERENCES chainsaw_channel_events(id);

ALTER TABLE ONLY chainsaw_channels
  ADD CONSTRAINT chainsaw_channels_settled_event_id_fkey FOREIGN KEY (settled_event_id) REFERENCES chainsaw_channel_events(id);

ALTER TABLE ONLY chainsaw_channels
  ADD CONSTRAINT chainsaw_channels_start_settling_event_id_fkey FOREIGN KEY (start_settling_event_id) REFERENCES chainsaw_channel_events(id);

ALTER TABLE ONLY chainsaw_ledger_channels_deposits
  ADD CONSTRAINT chainsaw_ledger_channels_depo_ledger_channel_state_updates_fkey FOREIGN KEY (ledger_channel_state_updates_id) REFERENCES ledger_channel_state_updates(id);

ALTER TABLE ONLY chainsaw_ledger_channels_deposits
  ADD CONSTRAINT chainsaw_ledger_channels_deposits_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES chainsaw_ledger_channels(channel_id);

ALTER TABLE ONLY chainsaw_ledger_channels_deposits
  ADD CONSTRAINT chainsaw_ledger_channels_deposits_deposit_event_id_fkey FOREIGN KEY (deposit_event_id) REFERENCES chainsaw_channel_events(id);

ALTER TABLE ONLY chainsaw_ledger_channels
  ADD CONSTRAINT chainsaw_ledger_channels_lc_closed_event_id_fkey FOREIGN KEY (lc_closed_event_id) REFERENCES chainsaw_channel_events(id);

ALTER TABLE ONLY chainsaw_ledger_channels
  ADD CONSTRAINT chainsaw_ledger_channels_lc_joined_event_id_fkey FOREIGN KEY (lc_joined_event_id) REFERENCES chainsaw_channel_events(id);

ALTER TABLE ONLY chainsaw_ledger_channels
  ADD CONSTRAINT chainsaw_ledger_channels_lc_opened_event_id_fkey FOREIGN KEY (lc_opened_event_id) REFERENCES chainsaw_channel_events(id);

ALTER TABLE ONLY chainsaw_ledger_channels
  ADD CONSTRAINT chainsaw_ledger_channels_lc_start_settling_event_id_fkey FOREIGN KEY (lc_start_settling_event_id) REFERENCES chainsaw_channel_events(id);

ALTER TABLE ONLY chainsaw_events
  ADD CONSTRAINT channel_id_fk FOREIGN KEY (channel_id) REFERENCES _cm_channels(id);

ALTER TABLE ONLY custodial_payments
  ADD CONSTRAINT custodial_payments_disbursement_id_fkey FOREIGN KEY (disbursement_id) REFERENCES _cm_channel_updates(id);

ALTER TABLE ONLY custodial_payments
  ADD CONSTRAINT custodial_payments_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES _payments(id);

ALTER TABLE ONLY _cm_channels
  ADD CONSTRAINT latest_update_id_fk FOREIGN KEY (latest_update_id) REFERENCES _cm_channel_updates(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY _cm_threads
  ADD CONSTRAINT latest_update_id_fk FOREIGN KEY (latest_update_id) REFERENCES _cm_thread_updates(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY ledger_channel_state_updates
  ADD CONSTRAINT ledger_channel_state_updates_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES chainsaw_ledger_channels(channel_id);

ALTER TABLE ONLY ledger_channel_state_updates
  ADD CONSTRAINT ledger_channel_state_updates_exchange_rate_id_fkey FOREIGN KEY (exchange_rate_id) REFERENCES exchange_rates(id);

ALTER TABLE ONLY ledger_channel_state_updates
  ADD CONSTRAINT ledger_channel_state_updates_vc_id_fkey FOREIGN KEY (vc_id) REFERENCES virtual_channels(channel_id);

ALTER TABLE ONLY payment_meta
  ADD CONSTRAINT payment_meta_lcupdatetoken_fkey FOREIGN KEY (lcupdatetoken) REFERENCES ledger_channel_state_updates(id);

ALTER TABLE ONLY payment_meta
  ADD CONSTRAINT payment_meta_vcupdatetoken_fkey FOREIGN KEY (vcupdatetoken) REFERENCES virtual_channel_state_updates(id);

ALTER TABLE ONLY virtual_channel_state_updates
  ADD CONSTRAINT virtual_channel_state_updates_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES virtual_channels(channel_id);

ALTER TABLE ONLY virtual_channel_state_updates
  ADD CONSTRAINT virtual_channel_state_updates_exchange_rate_id_fkey FOREIGN KEY (exchange_rate_id) REFERENCES exchange_rates(id);

ALTER TABLE ONLY virtual_channels
  ADD CONSTRAINT virtual_channels_subchan_a_to_i_fkey FOREIGN KEY (subchan_a_to_i) REFERENCES chainsaw_ledger_channels(channel_id);

ALTER TABLE ONLY virtual_channels
  ADD CONSTRAINT virtual_channels_subchan_b_to_i_fkey FOREIGN KEY (subchan_b_to_i) REFERENCES chainsaw_ledger_channels(channel_id);

ALTER TABLE ONLY virtual_channels
  ADD CONSTRAINT virtual_channels_vc_init_event_id_fkey FOREIGN KEY (vc_init_event_id) REFERENCES chainsaw_channel_events(id);

ALTER TABLE ONLY virtual_channels
  ADD CONSTRAINT virtual_channels_vc_settled_event_id_fkey FOREIGN KEY (vc_settled_event_id) REFERENCES chainsaw_channel_events(id);

ALTER TABLE ONLY virtual_channels
  ADD CONSTRAINT virtual_channels_vc_start_settling_event_id_fkey FOREIGN KEY (vc_start_settling_event_id) REFERENCES chainsaw_channel_events(id);

ALTER TABLE ONLY withdrawals
  ADD CONSTRAINT withdrawals_exchange_rate_id_fkey FOREIGN KEY (exchange_rate_id) REFERENCES exchange_rates(id);
