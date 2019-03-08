--
-- PostgreSQL database dump
--

-- Dumped from database version 9.6.3
-- Dumped by pg_dump version 9.6.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: plpgsql; Type: EXTENSION; Schema: -; Owner: 
--

CREATE EXTENSION IF NOT EXISTS plpgsql WITH SCHEMA pg_catalog;


--
-- Name: EXTENSION plpgsql; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION plpgsql IS 'PL/pgSQL procedural language';


--
-- Name: hstore; Type: EXTENSION; Schema: -; Owner: 
--

CREATE EXTENSION IF NOT EXISTS hstore WITH SCHEMA public;


--
-- Name: EXTENSION hstore; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION hstore IS 'data type for storing sets of (key, value) pairs';


--
-- Name: unaccent; Type: EXTENSION; Schema: -; Owner: 
--

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;


--
-- Name: EXTENSION unaccent; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION unaccent IS 'text search dictionary that removes accents';


SET search_path = public, pg_catalog;

--
-- Name: calculation_method; Type: TYPE; Schema: public; Owner: wolever
--

CREATE TYPE calculation_method AS ENUM (
    'WEI_SUM',
    'PEGGED_FIAT',
    'CHANNEL_DISBURSEMENT'
);


ALTER TYPE calculation_method OWNER TO wolever;

--
-- Name: channel_claim_status; Type: TYPE; Schema: public; Owner: wolever
--

CREATE TYPE channel_claim_status AS ENUM (
    'NEW',
    'PENDING',
    'CONFIRMED',
    'FAILED'
);


ALTER TYPE channel_claim_status OWNER TO wolever;

--
-- Name: cm_channel_status; Type: TYPE; Schema: public; Owner: wolever
--

CREATE TYPE cm_channel_status AS ENUM (
    'CS_OPEN',
    'CS_CHANNEL_DISPUTE',
    'CS_THREAD_DISPUTE'
);


ALTER TYPE cm_channel_status OWNER TO wolever;

--
-- Name: cm_channel_update_invalid_reason; Type: TYPE; Schema: public; Owner: wolever
--

CREATE TYPE cm_channel_update_invalid_reason AS ENUM (
    'CU_INVALID_EXPIRED'
);


ALTER TYPE cm_channel_update_invalid_reason OWNER TO wolever;

--
-- Name: cm_channel_update_reason; Type: TYPE; Schema: public; Owner: wolever
--

CREATE TYPE cm_channel_update_reason AS ENUM (
    'Payment',
    'Exchange',
    'ProposePending',
    'ConfirmPending',
    'OpenThread',
    'CloseThread'
);


ALTER TYPE cm_channel_update_reason OWNER TO wolever;

--
-- Name: cm_event_type; Type: TYPE; Schema: public; Owner: wolever
--

CREATE TYPE cm_event_type AS ENUM (
    'DidHubContractWithdraw',
    'DidUpdateChannel',
    'DidStartExitChannel',
    'DidEmptyChannel',
    'DidStartExitThread',
    'DidEmptyThread',
    'DidNukeThread'
);


ALTER TYPE cm_event_type OWNER TO wolever;

--
-- Name: csw_channel_event_type; Type: TYPE; Schema: public; Owner: wolever
--

CREATE TYPE csw_channel_event_type AS ENUM (
    'DidOpen',
    'DidDeposit',
    'DidClaim',
    'DidStartSettling',
    'DidSettle',
    'DidLCOpen',
    'DidLCJoin',
    'DidLCDeposit',
    'DidLCClose',
    'DidLCUpdateState',
    'DidVCInit',
    'DidVCSettle',
    'DidVCClose'
);


ALTER TYPE csw_channel_event_type OWNER TO wolever;

--
-- Name: csw_channel_state; Type: TYPE; Schema: public; Owner: wolever
--

CREATE TYPE csw_channel_state AS ENUM (
    'CS_OPEN',
    'CS_SETTLING',
    'CS_SETTLED'
);


ALTER TYPE csw_channel_state OWNER TO wolever;

--
-- Name: csw_eth_address; Type: DOMAIN; Schema: public; Owner: wolever
--

CREATE DOMAIN csw_eth_address AS character varying(42)
	CONSTRAINT csw_eth_address_check CHECK (((VALUE)::text ~* '^0x[a-f0-9]{40}$'::text));


ALTER DOMAIN csw_eth_address OWNER TO wolever;

--
-- Name: csw_ledger_channel_state; Type: TYPE; Schema: public; Owner: wolever
--

CREATE TYPE csw_ledger_channel_state AS ENUM (
    'LCS_OPENING',
    'LCS_OPENED',
    'LCS_SETTLING',
    'LCS_SETTLED'
);


ALTER TYPE csw_ledger_channel_state OWNER TO wolever;

--
-- Name: csw_sha3_hash; Type: DOMAIN; Schema: public; Owner: wolever
--

CREATE DOMAIN csw_sha3_hash AS character varying(66)
	CONSTRAINT csw_sha3_hash_check CHECK (((VALUE)::text ~* '^0x[a-f0-9]{64}$'::text));


ALTER DOMAIN csw_sha3_hash OWNER TO wolever;

--
-- Name: csw_virtual_channel_state; Type: TYPE; Schema: public; Owner: wolever
--

CREATE TYPE csw_virtual_channel_state AS ENUM (
    'VCS_OPENING',
    'VCS_OPENED',
    'VCS_SETTLING',
    'VCS_SETTLED'
);


ALTER TYPE csw_virtual_channel_state OWNER TO wolever;

--
-- Name: disbursements_status; Type: TYPE; Schema: public; Owner: wolever
--

CREATE TYPE disbursements_status AS ENUM (
    'NEW',
    'PENDING',
    'CONFIRMED',
    'FAILED'
);


ALTER TYPE disbursements_status OWNER TO wolever;

--
-- Name: eth_signature; Type: DOMAIN; Schema: public; Owner: wolever
--

CREATE DOMAIN eth_signature AS character varying(132)
	CONSTRAINT eth_signature_check CHECK (((VALUE)::text ~* '^0x[a-f0-9]{130}$'::text));


ALTER DOMAIN eth_signature OWNER TO wolever;

--
-- Name: fiat_amount; Type: DOMAIN; Schema: public; Owner: wolever
--

CREATE DOMAIN fiat_amount AS numeric(78,2);


ALTER DOMAIN fiat_amount OWNER TO wolever;

--
-- Name: ledger_channel_state_update_reason; Type: TYPE; Schema: public; Owner: wolever
--

CREATE TYPE ledger_channel_state_update_reason AS ENUM (
    'VC_OPENED',
    'VC_CLOSED',
    'LC_DEPOSIT',
    'LC_FAST_CLOSE',
    'LC_PAYMENT'
);


ALTER TYPE ledger_channel_state_update_reason OWNER TO wolever;

--
-- Name: token_amount; Type: DOMAIN; Schema: public; Owner: wolever
--

CREATE DOMAIN token_amount AS numeric(78,0);


ALTER DOMAIN token_amount OWNER TO wolever;

--
-- Name: wei_amount; Type: DOMAIN; Schema: public; Owner: wolever
--

CREATE DOMAIN wei_amount AS numeric(78,0);


ALTER DOMAIN wei_amount OWNER TO wolever;

--
-- Name: withdrawal_status; Type: TYPE; Schema: public; Owner: wolever
--

CREATE TYPE withdrawal_status AS ENUM (
    'NEW',
    'PENDING',
    'CONFIRMED',
    'FAILED'
);


ALTER TYPE withdrawal_status OWNER TO wolever;

--
-- Name: applicable_exchange_rate(bigint, integer); Type: FUNCTION; Schema: public; Owner: wolever
--

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


ALTER FUNCTION public.applicable_exchange_rate(ts bigint, epsilon integer, OUT id bigint, OUT retrievedat bigint, OUT base character varying, OUT rate_usd fiat_amount) OWNER TO wolever;

--
-- Name: chainsaw_insert_event(csw_eth_address, csw_eth_address, integer, csw_sha3_hash, csw_sha3_hash, integer, csw_eth_address, double precision, cm_event_type, jsonb); Type: FUNCTION; Schema: public; Owner: wolever
--

CREATE FUNCTION chainsaw_insert_event(hub csw_eth_address, _contract csw_eth_address, block_number integer, block_hash csw_sha3_hash, _tx_hash csw_sha3_hash, _log_index integer, sender csw_eth_address, js_timestamp double precision, event_type cm_event_type, fields jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
declare
    _user csw_eth_address;
    chainsaw_event chainsaw_events;
    ts timestamp with time zone := to_timestamp(js_timestamp / 1000.0);
    chan_create_error text;
    channel _cm_channels;
    row_count integer;
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

            insert into _cm_channels (contract, hub, "user", recipient)
            values (_contract, hub, _user, _user)
            returning * into channel;
        end if;
    end if;

    -- Insert the chainsaw event

    insert into chainsaw_events (
        contract,
        ts,
        block_hash, block_number, tx_hash, log_index,
        sender,
        channel_id, event_type, fields
    )
    values (
        _contract,
        ts,
        block_hash, block_number, _tx_hash, _log_index,
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
            tx_count_chain = jsonb_extract_path_text(fields, 'txCount', '1')::integer and
            chainsaw_resolution_event_id is null;

        get diagnostics row_count = ROW_COUNT;
        if row_count <> 1 then
            raise exception 'chainsaw event found without matching state update (rows: %, sender: %, channel: %, txCount: %)',
                row_count,
                sender,
                channel_id,
                jsonb_extract_path_text(fields, 'txCount');
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
        raise exception 'assertion error: got unexpected unique_violation';
    end if;

    return jsonb_build_object(
        'duplicate', true,
        'chainsaw_event_id', chainsaw_event.id,
        'channel_id', chainsaw_event.channel_id
    );

end
$$;


ALTER FUNCTION public.chainsaw_insert_event(hub csw_eth_address, _contract csw_eth_address, block_number integer, block_hash csw_sha3_hash, _tx_hash csw_sha3_hash, _log_index integer, sender csw_eth_address, js_timestamp double precision, event_type cm_event_type, fields jsonb) OWNER TO wolever;

--
-- Name: cm_channel_insert_update(bigint, cm_channel_update_reason, csw_eth_address, bigint, jsonb); Type: FUNCTION; Schema: public; Owner: wolever
--

CREATE FUNCTION cm_channel_insert_update(channel_id bigint, reason cm_channel_update_reason, originator csw_eth_address, chainsaw_event_id bigint, update_obj jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
declare
    channel _cm_channels;
    update_row _cm_channel_updates;
    sig_hub eth_signature := json_null(update_obj, 'sigHub', 'hex');
    sig_user eth_signature := json_null(update_obj, 'sigUser', 'hex');
begin
    -- Note: assume that the channel already exists. This should be safe
    -- because there shouldn't be any state updates except as the result of
    -- a chainsaw event, which will create the channel.
    -- In theory, though, this restriction could be lifted and this function
    -- could accept the (contract, hub, user) and create the channel.

    insert into _cm_channel_updates (
        channel_id, reason, originator,

        hub_signed_on, user_signed_on,

        chainsaw_event_id,

        recipient,

        wei_balance_hub, wei_balance_user,

        token_balance_hub, token_balance_user,

        pending_wei_deposit_hub, pending_wei_deposit_user,

        pending_token_deposit_hub, pending_token_deposit_user,

        pending_wei_withdrawal_hub, pending_wei_withdrawal_user,

        pending_token_withdrawal_hub, pending_token_withdrawal_user,

        tx_count_global, tx_count_chain,

        thread_root, thread_count,

        timeout,

        sig_hub, sig_user
    ) values (
        channel_id, reason, originator,

        case when sig_hub is null then null else now() end,
        case when sig_user is null then null else now() end,

        chainsaw_event_id,

        json_not_null(update_obj, 'recipient', 'hex'),

        json_not_null(update_obj, 'weiBalanceHub', 'uint256')::wei_amount,
        json_not_null(update_obj, 'weiBalanceUser', 'uint256')::wei_amount,

        json_not_null(update_obj, 'tokenBalanceHub', 'uint256')::token_amount,
        json_not_null(update_obj, 'tokenBalanceUser', 'uint256')::token_amount,

        json_null(update_obj, 'pendingDepositWeiHub', 'uint256')::wei_amount,
        json_null(update_obj, 'pendingDepositWeiUser', 'uint256')::wei_amount,

        json_null(update_obj, 'pendingDepositTokenHub', 'uint256')::token_amount,
        json_null(update_obj, 'pendingDepositTokenUser', 'uint256')::token_amount,

        json_null(update_obj, 'pendingWithdrawalWeiHub', 'uint256')::wei_amount,
        json_null(update_obj, 'pendingWithdrawalWeiUser', 'uint256')::wei_amount,

        json_null(update_obj, 'pendingWithdrawalTokenHub', 'uint256')::token_amount,
        json_null(update_obj, 'pendingWithdrawalTokenUser', 'uint256')::token_amount,

        json_not_null(update_obj, 'txCountGlobal', 'uint256')::integer,
        json_not_null(update_obj, 'txCountChain', 'uint256')::integer,

        json_not_null(update_obj, 'threadRoot', 'hex')::csw_sha3_hash,
        json_not_null(update_obj, 'threadCount', 'uint')::integer,

        json_null(update_obj, 'timeout', 'uint')::integer,

        sig_hub,
        sig_user
    ) returning * into update_row;

    update _cm_channels
    set
        recipient = update_row.recipient,

        wei_balance_hub = update_row.wei_balance_hub,
        wei_balance_user = update_row.wei_balance_user,

        token_balance_user = update_row.token_balance_user,
        token_balance_hub = update_row.token_balance_hub,

        pending_wei_deposit_hub = update_row.pending_wei_deposit_hub,
        pending_wei_deposit_user = update_row.pending_wei_deposit_user,

        pending_token_deposit_hub = update_row.pending_token_deposit_hub,
        pending_token_deposit_user = update_row.pending_token_deposit_user,

        pending_wei_withdrawal_hub = update_row.pending_wei_withdrawal_hub,
        pending_wei_withdrawal_user = update_row.pending_wei_withdrawal_user,

        pending_token_withdrawal_hub = update_row.pending_token_withdrawal_hub,
        pending_token_withdrawal_user = update_row.pending_token_withdrawal_user,

        tx_count_global = update_row.tx_count_global,
        tx_count_chain = update_row.tx_count_chain,

        thread_root = update_row.thread_root,
        thread_count = update_row.thread_count
    where id = channel_id
    returning * into channel;

    -- This _should_ never happen (because of the fk check on channel_id),
    -- but might as well make it explicit.
    if channel.id is null then
        raise exception 'invalid channel id: % (no such channel exists)', channel_id;
    end if;

    return row_to_json(update_row);

exception when unique_violation then
    raise exception 'TODO: ignore duplicate events';

end
$$;


ALTER FUNCTION public.cm_channel_insert_update(channel_id bigint, reason cm_channel_update_reason, originator csw_eth_address, chainsaw_event_id bigint, update_obj jsonb) OWNER TO wolever;

--
-- Name: cm_channels_check_update_trigger(); Type: FUNCTION; Schema: public; Owner: wolever
--

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
        (OLD.wei_balance_hub + OLD.wei_balance_user <> NEW.wei_balance_hub + NEW.wei_balance_user)
    ) then
        raise exception 'Update changes total channel wei balance (old: [%, %], new: [%, %])',
            OLD.wei_balance_hub / 1e18,
            OLD.wei_balance_user / 1e18,
            NEW.wei_balance_hub / 1e18,
            NEW.wei_balance_user / 1e18;
    end if;

    if (
        OLD.thread_count = NEW.thread_count AND
        (OLD.token_balance_hub + OLD.token_balance_user <> NEW.token_balance_hub + NEW.token_balance_user)
    ) then
        raise exception 'Update changes total channel token balance (old: [%, %], new: [%, %])',
            OLD.token_balance_hub / 1e18,
            OLD.token_balance_user / 1e18,
            NEW.token_balance_hub / 1e18,
            NEW.token_balance_user / 1e18;
    end if;
    */

    -- TODO: Check if OLD.thread_count = NEW.thread_count + 1
    -- OLD.wei_balance_hub + OLD.wei_balance_user == NEW.wei_balance_hub + NEW.wei_balance_user - (NEW.thread_balance_sender + NEW.thread_balance_receiver)

    -- TODO: Check if OLD.thread_count = NEW.thread_count - 1
    -- OLD.wei_balance_hub + OLD.wei_balance_user == NEW.wei_balance_hub + NEW.wei_balance_user + NEW.thread_balance_sender + NEW.thread_balance_receiver

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
$$;


ALTER FUNCTION public.cm_channels_check_update_trigger() OWNER TO wolever;

--
-- Name: cm_threads_check_update_trigger(); Type: FUNCTION; Schema: public; Owner: wolever
--

CREATE FUNCTION cm_threads_check_update_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
    -- Check that the dispute status is reasonable
    if (
        coalesce(
            NEW.thread_dispute_event_id,
            NEW.thread_dispute_ends_on,
            NEW.thread_dispute_originator
        ) is not null
    ) then
        raise exception 'Channel has invalid channel/thread dispute status: %', NEW;
    end if;

    -- Check that total balance is preserved
    if (
        OLD.wei_balance_sender + OLD.wei_balance_receiver <> NEW.wei_balance_sender + NEW.wei_balance_receiver
    ) then
        raise exception 'Update changes total thread wei balance (old: [%, %], new: [%, %])',
            OLD.wei_balance_sender / 1e18,
            OLD.wei_balance_receiver / 1e18,
            NEW.wei_balance_sender / 1e18,
            NEW.wei_balance_receiver / 1e18;
    end if;

    if (
        OLD.wei_balance_sender + OLD.wei_balance_receiver <> NEW.wei_balance_sender + NEW.wei_balance_receiver
    ) then
        raise exception 'Update changes total thread token balance (old: [%, %], new: [%, %])',
            OLD.token_balance_hub / 1e18,
            OLD.token_balance_user / 1e18,
            NEW.token_balance_hub / 1e18,
            NEW.token_balance_user / 1e18;
    end if;

    -- Check that receiver balance increases
    if (
        NEW.wei_balance_sender > OLD.wei_balance_sender
    ) then
        raise exception 'Update is not sending thread wei balance in the right direction (old: [%, %], new: [%, %])',
            OLD.wei_balance_receiver / 1e18,
            OLD.wei_balance_sender / 1e18,
            NEW.wei_balance_receiver / 1e18,
            NEW.wei_balance_sender / 1e18;
    end if;

    if (
        NEW.token_balance_sender > OLD.token_balance_sender
    ) then
        raise exception 'Update is not sending thread token balance in the right direction (old: [%, %], new: [%, %])',
            OLD.token_balance_sender / 1e18,
            OLD.token_balance_receiver / 1e18,
            NEW.token_balance_sender / 1e18,
            NEW.token_balance_receiver / 1e18;
    end if;

    -- Check that the tx count increases monotonically
    if (
        NEW.tx_count < OLD.tx_count
    ) then
        raise exception 'Update lowers channel tx_count (old: %, new: %)',
            NEW.tx_count,
            OLD.tx_count;
    end if;

    -- TODO: Probably more checks

end;
$$;


ALTER FUNCTION public.cm_threads_check_update_trigger() OWNER TO wolever;

--
-- Name: create_withdrawal_channel_disbursement(text, text, wei_amount); Type: FUNCTION; Schema: public; Owner: wolever
--

CREATE FUNCTION create_withdrawal_channel_disbursement(_initiator text, _recipient text, _amountwei wei_amount) RETURNS bigint
    LANGUAGE plpgsql
    AS $$
    DECLARE
      _rate fiat_amount;
      _amountusd fiat_amount;
      _id BIGINT;
      _rate_id BIGINT;
      _now BIGINT;
    BEGIN
      -- Return values: -1 if there's no available payment. A numeric ID otherwise.
      SELECT now_millis() INTO _now;
    
      SELECT rate_usd, id INTO _rate, _rate_id FROM applicable_exchange_rate(_now);
      SELECT wei_to_fiat(_amountwei, _rate) INTO _amountusd;
      
      INSERT INTO withdrawals(initiator, recipient, amountusd, amountwei, exchange_rate_id, status, createdat, method) VALUES (_initiator, _recipient, _amountusd, _amountwei, _rate_id, 'NEW', _now, 'CHANNEL_DISBURSEMENT') RETURNING id INTO _id;
      UPDATE payment SET withdrawal_id = _id WHERE token in (select token from payments where receiver = _recipient AND withdrawal_id IS NULL);
      RETURN _id;
    END;
    $$;


ALTER FUNCTION public.create_withdrawal_channel_disbursement(_initiator text, _recipient text, _amountwei wei_amount) OWNER TO wolever;

--
-- Name: create_withdrawal_usd_amount(text); Type: FUNCTION; Schema: public; Owner: wolever
--

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


ALTER FUNCTION public.create_withdrawal_usd_amount(_recipient text) OWNER TO wolever;

--
-- Name: create_withdrawal_wei_amount(text); Type: FUNCTION; Schema: public; Owner: wolever
--

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


ALTER FUNCTION public.create_withdrawal_wei_amount(_recipient text) OWNER TO wolever;

--
-- Name: disburesment_stamp_now(); Type: FUNCTION; Schema: public; Owner: wolever
--

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


ALTER FUNCTION public.disburesment_stamp_now() OWNER TO wolever;

--
-- Name: fiat_to_wei(fiat_amount, numeric); Type: FUNCTION; Schema: public; Owner: wolever
--

CREATE FUNCTION fiat_to_wei(amount_usd fiat_amount, exchange_rate numeric) RETURNS numeric
    LANGUAGE sql
    AS $$
      SELECT (amount_usd / exchange_rate * 1e18) AS result
    $$;


ALTER FUNCTION public.fiat_to_wei(amount_usd fiat_amount, exchange_rate numeric) OWNER TO wolever;

--
-- Name: hex_normalize(text, text, boolean); Type: FUNCTION; Schema: public; Owner: wolever
--

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


ALTER FUNCTION public.hex_normalize(field text, val text, allow_null boolean) OWNER TO wolever;

--
-- Name: json_not_null(jsonb, text, text); Type: FUNCTION; Schema: public; Owner: wolever
--

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


ALTER FUNCTION public.json_not_null(obj jsonb, field text, cast_as text) OWNER TO wolever;

--
-- Name: json_null(jsonb, text, text); Type: FUNCTION; Schema: public; Owner: wolever
--

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


ALTER FUNCTION public.json_null(obj jsonb, field text, cast_as text) OWNER TO wolever;

--
-- Name: materialize_chainsaw_channel(); Type: FUNCTION; Schema: public; Owner: wolever
--

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


ALTER FUNCTION public.materialize_chainsaw_channel() OWNER TO wolever;

--
-- Name: materialize_chainsaw_ledger_channel(); Type: FUNCTION; Schema: public; Owner: wolever
--

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


ALTER FUNCTION public.materialize_chainsaw_ledger_channel() OWNER TO wolever;

--
-- Name: now_millis(); Type: FUNCTION; Schema: public; Owner: wolever
--

CREATE FUNCTION now_millis() RETURNS bigint
    LANGUAGE sql
    AS $$
      SELECT ts_to_millis(NOW()) AS result;
    $$;


ALTER FUNCTION public.now_millis() OWNER TO wolever;

--
-- Name: stamp_exchange_rate(); Type: FUNCTION; Schema: public; Owner: wolever
--

CREATE FUNCTION stamp_exchange_rate() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      BEGIN
        NEW.exchange_rate_id := (SELECT id FROM applicable_exchange_rate(now_millis()));
        RETURN NEW;
      END;
    $$;


ALTER FUNCTION public.stamp_exchange_rate() OWNER TO wolever;

--
-- Name: ts_to_millis(timestamp with time zone); Type: FUNCTION; Schema: public; Owner: wolever
--

CREATE FUNCTION ts_to_millis(ts timestamp with time zone) RETURNS bigint
    LANGUAGE sql IMMUTABLE
    AS $$
      SELECT FLOOR(EXTRACT(EPOCH FROM ts) * 1000)::BIGINT AS result;
    $$;


ALTER FUNCTION public.ts_to_millis(ts timestamp with time zone) OWNER TO wolever;

--
-- Name: validate_disbursement_status(); Type: FUNCTION; Schema: public; Owner: wolever
--

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


ALTER FUNCTION public.validate_disbursement_status() OWNER TO wolever;

--
-- Name: validate_status(); Type: FUNCTION; Schema: public; Owner: wolever
--

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


ALTER FUNCTION public.validate_status() OWNER TO wolever;

--
-- Name: wei_to_fiat(wei_amount, numeric); Type: FUNCTION; Schema: public; Owner: wolever
--

CREATE FUNCTION wei_to_fiat(amount_wei wei_amount, exchange_rate numeric) RETURNS numeric
    LANGUAGE sql
    AS $$
      SELECT (amount_wei * exchange_rate * 1e-18) AS result
    $$;


ALTER FUNCTION public.wei_to_fiat(amount_wei wei_amount, exchange_rate numeric) OWNER TO wolever;

SET default_tablespace = '';

SET default_with_oids = false;

--
-- Name: _cm_channel_updates; Type: TABLE; Schema: public; Owner: wolever
--

CREATE TABLE _cm_channel_updates (
    id bigint NOT NULL,
    channel_id bigint,
    created_on timestamp with time zone DEFAULT now() NOT NULL,
    reason cm_channel_update_reason NOT NULL,
    originator csw_eth_address NOT NULL,
    hub_signed_on timestamp with time zone,
    user_signed_on timestamp with time zone,
    invalid cm_channel_update_invalid_reason,
    chainsaw_event_id bigint,
    chainsaw_resolution_event_id bigint,
    recipient csw_eth_address NOT NULL,
    wei_balance_hub wei_amount NOT NULL,
    wei_balance_user wei_amount NOT NULL,
    token_balance_hub token_amount NOT NULL,
    token_balance_user token_amount NOT NULL,
    pending_wei_deposit_hub wei_amount,
    pending_wei_deposit_user wei_amount,
    pending_token_deposit_hub token_amount,
    pending_token_deposit_user token_amount,
    pending_wei_withdrawal_hub wei_amount,
    pending_wei_withdrawal_user wei_amount,
    pending_token_withdrawal_hub token_amount,
    pending_token_withdrawal_user token_amount,
    tx_count_global integer NOT NULL,
    tx_count_chain integer NOT NULL,
    thread_root csw_sha3_hash,
    thread_count integer NOT NULL,
    timeout integer,
    sig_hub eth_signature,
    sig_user eth_signature,
    CONSTRAINT _cm_channel_updates_check CHECK (
CASE
    WHEN (sig_hub IS NULL) THEN (hub_signed_on IS NULL)
    ELSE (hub_signed_on IS NOT NULL)
END),
    CONSTRAINT _cm_channel_updates_check1 CHECK (
CASE
    WHEN (sig_user IS NULL) THEN (user_signed_on IS NULL)
    ELSE (user_signed_on IS NOT NULL)
END),
    CONSTRAINT _cm_channel_updates_check2 CHECK (
CASE
    WHEN ((thread_root)::text ~ '^0x0+$'::text) THEN (thread_count = 0)
    ELSE (thread_count > 0)
END),
    CONSTRAINT _cm_channel_updates_thread_count_check CHECK ((thread_count >= 0))
);


ALTER TABLE _cm_channel_updates OWNER TO wolever;

--
-- Name: _cm_channel_updates_id_seq; Type: SEQUENCE; Schema: public; Owner: wolever
--

CREATE SEQUENCE _cm_channel_updates_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE _cm_channel_updates_id_seq OWNER TO wolever;

--
-- Name: _cm_channel_updates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: wolever
--

ALTER SEQUENCE _cm_channel_updates_id_seq OWNED BY _cm_channel_updates.id;


--
-- Name: _cm_channels; Type: TABLE; Schema: public; Owner: wolever
--

CREATE TABLE _cm_channels (
    id bigint NOT NULL,
    contract csw_eth_address NOT NULL,
    hub csw_eth_address NOT NULL,
    "user" csw_eth_address NOT NULL,
    status cm_channel_status DEFAULT 'CS_OPEN'::cm_channel_status NOT NULL,
    recipient csw_eth_address NOT NULL,
    wei_balance_hub wei_amount DEFAULT 0 NOT NULL,
    wei_balance_user wei_amount DEFAULT 0 NOT NULL,
    token_balance_user token_amount DEFAULT 0 NOT NULL,
    token_balance_hub token_amount DEFAULT 0 NOT NULL,
    pending_wei_deposit_hub wei_amount,
    pending_wei_deposit_user wei_amount,
    pending_token_deposit_hub token_amount,
    pending_token_deposit_user token_amount,
    pending_wei_withdrawal_hub wei_amount,
    pending_wei_withdrawal_user wei_amount,
    pending_token_withdrawal_hub token_amount,
    pending_token_withdrawal_user token_amount,
    tx_count_global integer DEFAULT 0 NOT NULL,
    tx_count_chain integer DEFAULT 0 NOT NULL,
    thread_root csw_sha3_hash DEFAULT rpad('0x'::text, 66, '0'::text),
    thread_count integer DEFAULT 0 NOT NULL,
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
    WHEN ((thread_root)::text ~ '^0x0+$'::text) THEN (thread_count = 0)
    ELSE (thread_count > 0)
END),
    CONSTRAINT _cm_channels_thread_count_check CHECK ((thread_count >= 0))
);


ALTER TABLE _cm_channels OWNER TO wolever;

--
-- Name: _cm_channels_id_seq; Type: SEQUENCE; Schema: public; Owner: wolever
--

CREATE SEQUENCE _cm_channels_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE _cm_channels_id_seq OWNER TO wolever;

--
-- Name: _cm_channels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: wolever
--

ALTER SEQUENCE _cm_channels_id_seq OWNED BY _cm_channels.id;


--
-- Name: applied_wallet_migrations; Type: TABLE; Schema: public; Owner: wolever
--

CREATE TABLE applied_wallet_migrations (
    id bigint NOT NULL,
    migration_id bigint NOT NULL,
    wallet_address character varying NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE applied_wallet_migrations OWNER TO wolever;

--
-- Name: applied_wallet_migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: wolever
--

CREATE SEQUENCE applied_wallet_migrations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE applied_wallet_migrations_id_seq OWNER TO wolever;

--
-- Name: applied_wallet_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: wolever
--

ALTER SEQUENCE applied_wallet_migrations_id_seq OWNED BY applied_wallet_migrations.id;


--
-- Name: applied_wallet_migrations_migration_id_seq; Type: SEQUENCE; Schema: public; Owner: wolever
--

CREATE SEQUENCE applied_wallet_migrations_migration_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE applied_wallet_migrations_migration_id_seq OWNER TO wolever;

--
-- Name: applied_wallet_migrations_migration_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: wolever
--

ALTER SEQUENCE applied_wallet_migrations_migration_id_seq OWNED BY applied_wallet_migrations.migration_id;


--
-- Name: available_wallet_migrations; Type: TABLE; Schema: public; Owner: wolever
--

CREATE TABLE available_wallet_migrations (
    id bigint NOT NULL,
    migration_name character varying NOT NULL
);


ALTER TABLE available_wallet_migrations OWNER TO wolever;

--
-- Name: available_wallet_migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: wolever
--

CREATE SEQUENCE available_wallet_migrations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE available_wallet_migrations_id_seq OWNER TO wolever;

--
-- Name: available_wallet_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: wolever
--

ALTER SEQUENCE available_wallet_migrations_id_seq OWNED BY available_wallet_migrations.id;


--
-- Name: chainsaw_channel_events; Type: TABLE; Schema: public; Owner: wolever
--

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


ALTER TABLE chainsaw_channel_events OWNER TO wolever;

--
-- Name: chainsaw_channel_events_id_seq; Type: SEQUENCE; Schema: public; Owner: wolever
--

CREATE SEQUENCE chainsaw_channel_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE chainsaw_channel_events_id_seq OWNER TO wolever;

--
-- Name: chainsaw_channel_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: wolever
--

ALTER SEQUENCE chainsaw_channel_events_id_seq OWNED BY chainsaw_channel_events.id;


--
-- Name: chainsaw_channels; Type: TABLE; Schema: public; Owner: wolever
--

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


ALTER TABLE chainsaw_channels OWNER TO wolever;

--
-- Name: chainsaw_channels_deposits; Type: TABLE; Schema: public; Owner: wolever
--

CREATE TABLE chainsaw_channels_deposits (
    channel_id csw_sha3_hash,
    deposit_event_id bigint
);


ALTER TABLE chainsaw_channels_deposits OWNER TO wolever;

--
-- Name: chainsaw_channels_id_seq; Type: SEQUENCE; Schema: public; Owner: wolever
--

CREATE SEQUENCE chainsaw_channels_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE chainsaw_channels_id_seq OWNER TO wolever;

--
-- Name: chainsaw_channels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: wolever
--

ALTER SEQUENCE chainsaw_channels_id_seq OWNED BY chainsaw_channels.id;


--
-- Name: chainsaw_events; Type: TABLE; Schema: public; Owner: wolever
--

CREATE TABLE chainsaw_events (
    id bigint NOT NULL,
    contract csw_eth_address NOT NULL,
    ts timestamp with time zone NOT NULL,
    block_number integer NOT NULL,
    block_hash csw_sha3_hash NOT NULL,
    tx_hash csw_sha3_hash NOT NULL,
    log_index integer NOT NULL,
    sender csw_eth_address NOT NULL,
    channel_id bigint,
    event_type cm_event_type NOT NULL,
    fields jsonb NOT NULL
);


ALTER TABLE chainsaw_events OWNER TO wolever;

--
-- Name: chainsaw_events_id_seq; Type: SEQUENCE; Schema: public; Owner: wolever
--

CREATE SEQUENCE chainsaw_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE chainsaw_events_id_seq OWNER TO wolever;

--
-- Name: chainsaw_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: wolever
--

ALTER SEQUENCE chainsaw_events_id_seq OWNED BY chainsaw_events.id;


--
-- Name: chainsaw_ledger_channels; Type: TABLE; Schema: public; Owner: wolever
--

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


ALTER TABLE chainsaw_ledger_channels OWNER TO wolever;

--
-- Name: chainsaw_ledger_channels_deposits; Type: TABLE; Schema: public; Owner: wolever
--

CREATE TABLE chainsaw_ledger_channels_deposits (
    channel_id csw_sha3_hash,
    deposit_event_id bigint,
    ledger_channel_state_updates_id bigint
);


ALTER TABLE chainsaw_ledger_channels_deposits OWNER TO wolever;

--
-- Name: chainsaw_ledger_channels_id_seq; Type: SEQUENCE; Schema: public; Owner: wolever
--

CREATE SEQUENCE chainsaw_ledger_channels_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE chainsaw_ledger_channels_id_seq OWNER TO wolever;

--
-- Name: chainsaw_ledger_channels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: wolever
--

ALTER SEQUENCE chainsaw_ledger_channels_id_seq OWNED BY chainsaw_ledger_channels.id;


--
-- Name: chainsaw_poll_events; Type: TABLE; Schema: public; Owner: wolever
--

CREATE TABLE chainsaw_poll_events (
    block_number bigint NOT NULL,
    polled_at bigint NOT NULL,
    contract csw_eth_address NOT NULL,
    poll_type character varying DEFAULT 'FETCH_EVENTS'::character varying NOT NULL
);


ALTER TABLE chainsaw_poll_events OWNER TO wolever;

--
-- Name: channel; Type: TABLE; Schema: public; Owner: wolever
--

CREATE TABLE channel (
    "channelId" character varying NOT NULL,
    kind character varying,
    sender character varying,
    receiver character varying,
    value numeric(78,0),
    spent numeric(78,0),
    state smallint,
    "contractAddress" character varying
);


ALTER TABLE channel OWNER TO wolever;

--
-- Name: channel_claims; Type: TABLE; Schema: public; Owner: wolever
--

CREATE TABLE channel_claims (
    channel_id character varying,
    status channel_claim_status NOT NULL,
    createdat bigint NOT NULL,
    pendingat bigint,
    confirmedat bigint,
    failedat bigint
);


ALTER TABLE channel_claims OWNER TO wolever;

--
-- Name: cm_channel_updates; Type: VIEW; Schema: public; Owner: wolever
--

CREATE VIEW cm_channel_updates AS
 SELECT _cm_channel_updates.id,
    _cm_channel_updates.channel_id,
    _cm_channel_updates.created_on,
    _cm_channel_updates.reason,
    _cm_channel_updates.originator,
    _cm_channel_updates.hub_signed_on,
    _cm_channel_updates.user_signed_on,
    _cm_channel_updates.invalid,
    _cm_channel_updates.chainsaw_event_id,
    _cm_channel_updates.chainsaw_resolution_event_id,
    _cm_channel_updates.recipient,
    _cm_channel_updates.wei_balance_hub,
    _cm_channel_updates.wei_balance_user,
    _cm_channel_updates.token_balance_hub,
    _cm_channel_updates.token_balance_user,
    _cm_channel_updates.pending_wei_deposit_hub,
    _cm_channel_updates.pending_wei_deposit_user,
    _cm_channel_updates.pending_token_deposit_hub,
    _cm_channel_updates.pending_token_deposit_user,
    _cm_channel_updates.pending_wei_withdrawal_hub,
    _cm_channel_updates.pending_wei_withdrawal_user,
    _cm_channel_updates.pending_token_withdrawal_hub,
    _cm_channel_updates.pending_token_withdrawal_user,
    _cm_channel_updates.tx_count_global,
    _cm_channel_updates.tx_count_chain,
    _cm_channel_updates.thread_root,
    _cm_channel_updates.thread_count,
    _cm_channel_updates.timeout,
    _cm_channel_updates.sig_hub,
    _cm_channel_updates.sig_user
   FROM _cm_channel_updates;


ALTER TABLE cm_channel_updates OWNER TO wolever;

--
-- Name: cm_channels; Type: VIEW; Schema: public; Owner: wolever
--

CREATE VIEW cm_channels AS
 SELECT _cm_channels.id,
    _cm_channels.contract,
    _cm_channels.hub,
    _cm_channels."user",
    _cm_channels.status,
    _cm_channels.recipient,
    _cm_channels.wei_balance_hub,
    _cm_channels.wei_balance_user,
    _cm_channels.token_balance_user,
    _cm_channels.token_balance_hub,
    _cm_channels.pending_wei_deposit_hub,
    _cm_channels.pending_wei_deposit_user,
    _cm_channels.pending_token_deposit_hub,
    _cm_channels.pending_token_deposit_user,
    _cm_channels.pending_wei_withdrawal_hub,
    _cm_channels.pending_wei_withdrawal_user,
    _cm_channels.pending_token_withdrawal_hub,
    _cm_channels.pending_token_withdrawal_user,
    _cm_channels.tx_count_global,
    _cm_channels.tx_count_chain,
    _cm_channels.thread_root,
    _cm_channels.thread_count,
    _cm_channels.channel_dispute_event_id,
    _cm_channels.channel_dispute_ends_on,
    _cm_channels.channel_dispute_originator,
    _cm_channels.thread_dispute_event_id,
    _cm_channels.thread_dispute_ends_on,
    _cm_channels.thread_dispute_originator
   FROM _cm_channels;


ALTER TABLE cm_channels OWNER TO wolever;

--
-- Name: cm_thread_updates; Type: TABLE; Schema: public; Owner: wolever
--

CREATE TABLE cm_thread_updates (
    id bigint NOT NULL,
    thread_id bigint,
    created_on timestamp with time zone NOT NULL,
    originator csw_eth_address NOT NULL,
    sender_signed_on timestamp with time zone,
    wei_balance_sender wei_amount NOT NULL,
    wei_balance_receiver wei_amount NOT NULL,
    token_balance_sender token_amount NOT NULL,
    token_balance_receiver token_amount NOT NULL,
    tx_count integer NOT NULL,
    sig_sender eth_signature,
    CONSTRAINT cm_thread_updates_sig_sender_check CHECK ((sig_sender IS NOT NULL))
);


ALTER TABLE cm_thread_updates OWNER TO wolever;

--
-- Name: cm_thread_updates_id_seq; Type: SEQUENCE; Schema: public; Owner: wolever
--

CREATE SEQUENCE cm_thread_updates_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE cm_thread_updates_id_seq OWNER TO wolever;

--
-- Name: cm_thread_updates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: wolever
--

ALTER SEQUENCE cm_thread_updates_id_seq OWNED BY cm_thread_updates.id;


--
-- Name: cm_threads; Type: TABLE; Schema: public; Owner: wolever
--

CREATE TABLE cm_threads (
    id bigint NOT NULL,
    channel_id bigint,
    "user" csw_eth_address NOT NULL,
    sender csw_eth_address NOT NULL,
    receiver csw_eth_address NOT NULL,
    in_dispute boolean,
    wei_balance_sender wei_amount NOT NULL,
    wei_balance_receiver wei_amount NOT NULL,
    token_balance_sender token_amount NOT NULL,
    token_balance_receiver token_amount NOT NULL,
    tx_count integer NOT NULL,
    thread_dispute_event_id bigint,
    thread_dispute_ends_on timestamp with time zone,
    thread_dispute_originator csw_eth_address,
    CONSTRAINT cm_threads_check CHECK (
CASE in_dispute
    WHEN true THEN (thread_dispute_event_id IS NOT NULL)
    WHEN false THEN (thread_dispute_event_id IS NULL)
    ELSE NULL::boolean
END)
);


ALTER TABLE cm_threads OWNER TO wolever;

--
-- Name: cm_threads_id_seq; Type: SEQUENCE; Schema: public; Owner: wolever
--

CREATE SEQUENCE cm_threads_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE cm_threads_id_seq OWNER TO wolever;

--
-- Name: cm_threads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: wolever
--

ALTER SEQUENCE cm_threads_id_seq OWNED BY cm_threads.id;


--
-- Name: disbursements; Type: TABLE; Schema: public; Owner: wolever
--

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


ALTER TABLE disbursements OWNER TO wolever;

--
-- Name: disbursements_id_seq; Type: SEQUENCE; Schema: public; Owner: wolever
--

CREATE SEQUENCE disbursements_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE disbursements_id_seq OWNER TO wolever;

--
-- Name: disbursements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: wolever
--

ALTER SEQUENCE disbursements_id_seq OWNED BY disbursements.id;


--
-- Name: exchange_rates; Type: TABLE; Schema: public; Owner: wolever
--

CREATE TABLE exchange_rates (
    id bigint NOT NULL,
    retrievedat bigint,
    base character varying,
    rate_usd numeric(78,2)
);


ALTER TABLE exchange_rates OWNER TO wolever;

--
-- Name: exchange_rates_id_seq; Type: SEQUENCE; Schema: public; Owner: wolever
--

CREATE SEQUENCE exchange_rates_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE exchange_rates_id_seq OWNER TO wolever;

--
-- Name: exchange_rates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: wolever
--

ALTER SEQUENCE exchange_rates_id_seq OWNED BY exchange_rates.id;


--
-- Name: feature_flags; Type: TABLE; Schema: public; Owner: wolever
--

CREATE TABLE feature_flags (
    address csw_eth_address NOT NULL,
    booty_support boolean DEFAULT false NOT NULL
);


ALTER TABLE feature_flags OWNER TO wolever;

--
-- Name: gas_estimates; Type: TABLE; Schema: public; Owner: wolever
--

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


ALTER TABLE gas_estimates OWNER TO wolever;

--
-- Name: gas_estimates_id_seq; Type: SEQUENCE; Schema: public; Owner: wolever
--

CREATE SEQUENCE gas_estimates_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE gas_estimates_id_seq OWNER TO wolever;

--
-- Name: gas_estimates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: wolever
--

ALTER SEQUENCE gas_estimates_id_seq OWNED BY gas_estimates.id;


--
-- Name: global_settings; Type: TABLE; Schema: public; Owner: wolever
--

CREATE TABLE global_settings (
    withdrawals_enabled boolean DEFAULT true NOT NULL,
    payments_enabled boolean DEFAULT true NOT NULL
);


ALTER TABLE global_settings OWNER TO wolever;

--
-- Name: payment; Type: TABLE; Schema: public; Owner: wolever
--

CREATE TABLE payment (
    "channelId" character varying NOT NULL,
    kind character varying,
    token character varying NOT NULL,
    sender character varying,
    receiver character varying,
    price numeric(78,0),
    value numeric(78,0),
    "channelValue" numeric(78,0),
    v integer,
    r character varying,
    s character varying,
    meta character varying,
    "contractAddress" character varying,
    "createdAt" bigint,
    exchange_rate_id bigint NOT NULL,
    withdrawal_id bigint
);


ALTER TABLE payment OWNER TO wolever;

--
-- Name: hub_channels; Type: VIEW; Schema: public; Owner: wolever
--

CREATE VIEW hub_channels AS
 SELECT csw.id,
    csw.contract,
    csw.channel_id,
    csw.wei_value,
    csw.status,
    csw.opened_event_id,
    csw.start_settling_event_id,
    csw.settled_event_id,
    csw.claim_event_id,
    coe.sender,
    (coe.fields ->> 'receiver'::text) AS receiver,
    (coe.fields ->> 'settlingPeriod'::text) AS settling_period,
    COALESCE(p.value, (0)::numeric) AS wei_spent,
    ((csw.wei_value)::numeric - COALESCE(p.value, (0)::numeric)) AS wei_remaining
   FROM ((chainsaw_channels csw
     JOIN chainsaw_channel_events coe ON ((coe.id = csw.opened_event_id)))
     LEFT JOIN ( SELECT p_1."channelId",
            max(p_1.value) AS value
           FROM payment p_1
          GROUP BY p_1."channelId") p ON (((p."channelId")::text = (csw.channel_id)::text)));


ALTER TABLE hub_channels OWNER TO wolever;

--
-- Name: ledger_channel_state_updates; Type: TABLE; Schema: public; Owner: wolever
--

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


ALTER TABLE ledger_channel_state_updates OWNER TO wolever;

--
-- Name: hub_ledger_channels; Type: VIEW; Schema: public; Owner: wolever
--

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
             LEFT JOIN ledger_channel_state_updates lcsu ON (((lcsu.channel_id)::text = (csw.channel_id)::text)))
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


ALTER TABLE hub_ledger_channels OWNER TO wolever;

--
-- Name: virtual_channel_state_updates; Type: TABLE; Schema: public; Owner: wolever
--

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


ALTER TABLE virtual_channel_state_updates OWNER TO wolever;

--
-- Name: virtual_channels; Type: TABLE; Schema: public; Owner: wolever
--

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


ALTER TABLE virtual_channels OWNER TO wolever;

--
-- Name: hub_virtual_channels; Type: VIEW; Schema: public; Owner: wolever
--

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
             JOIN virtual_channel_state_updates vcsu ON (((vcsu.channel_id)::text = (vc.channel_id)::text)))
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


ALTER TABLE hub_virtual_channels OWNER TO wolever;

--
-- Name: ledger_channel_state_updates_id_seq; Type: SEQUENCE; Schema: public; Owner: wolever
--

CREATE SEQUENCE ledger_channel_state_updates_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE ledger_channel_state_updates_id_seq OWNER TO wolever;

--
-- Name: ledger_channel_state_updates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: wolever
--

ALTER SEQUENCE ledger_channel_state_updates_id_seq OWNED BY ledger_channel_state_updates.id;


--
-- Name: migrations; Type: TABLE; Schema: public; Owner: wolever
--

CREATE TABLE migrations (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    run_on timestamp without time zone NOT NULL
);


ALTER TABLE migrations OWNER TO wolever;

--
-- Name: migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: wolever
--

CREATE SEQUENCE migrations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE migrations_id_seq OWNER TO wolever;

--
-- Name: migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: wolever
--

ALTER SEQUENCE migrations_id_seq OWNED BY migrations.id;


--
-- Name: payment_meta; Type: TABLE; Schema: public; Owner: wolever
--

CREATE TABLE payment_meta (
    paymenttoken character varying,
    receiver character varying NOT NULL,
    type character varying NOT NULL,
    fields jsonb,
    vcupdatetoken bigint,
    lcupdatetoken bigint,
    purchase character varying(128) NOT NULL,
    CONSTRAINT valid_receiver CHECK (((receiver)::text ~* '^0x[a-fA-F0-9]{40}$'::text))
);


ALTER TABLE payment_meta OWNER TO wolever;

--
-- Name: payments; Type: VIEW; Schema: public; Owner: wolever
--

CREATE VIEW payments AS
 SELECT COALESCE(vcsu.channel_id, lcsu.channel_id) AS channel_id,
    COALESCE((vcsu.price_wei)::numeric, (lcsu.price_wei)::numeric, p.price) AS amountwei,
    COALESCE((vcsu.price_erc20)::numeric, (lcsu.price_erc20)::numeric) AS amounttoken,
    wei_to_fiat((COALESCE((vcsu.price_wei)::numeric, (lcsu.price_wei)::numeric, p.price))::wei_amount, COALESCE(e.rate_usd, el.rate_usd, ep.rate_usd)) AS amountusd,
    COALESCE((v.party_a)::character varying, (lc.party_a)::character varying, p.sender) AS sender,
    COALESCE((v.party_b)::character varying, (lc.party_i)::character varying, m.receiver) AS receiver,
    COALESCE(e.rate_usd, el.rate_usd, ep.rate_usd) AS rate_usd,
    m.fields,
    m.type,
    m.purchase,
    COALESCE((m.vcupdatetoken)::character varying, (m.lcupdatetoken)::character varying, m.paymenttoken) AS token,
    p.withdrawal_id,
    COALESCE(p."createdAt", vcsu.created_at, lcsu.created_at) AS created_at
   FROM ((((((((payment_meta m
     LEFT JOIN virtual_channel_state_updates vcsu ON ((vcsu.id = m.vcupdatetoken)))
     LEFT JOIN virtual_channels v ON (((vcsu.channel_id)::text = (v.channel_id)::text)))
     LEFT JOIN exchange_rates e ON ((vcsu.exchange_rate_id = e.id)))
     LEFT JOIN ledger_channel_state_updates lcsu ON ((lcsu.id = m.lcupdatetoken)))
     LEFT JOIN hub_ledger_channels lc ON (((lcsu.channel_id)::text = (lc.channel_id)::text)))
     LEFT JOIN exchange_rates el ON ((lcsu.exchange_rate_id = el.id)))
     LEFT JOIN payment p ON (((p.token)::text = (m.paymenttoken)::text)))
     LEFT JOIN exchange_rates ep ON ((p.exchange_rate_id = ep.id)));


ALTER TABLE payments OWNER TO wolever;

--
-- Name: token; Type: TABLE; Schema: public; Owner: wolever
--

CREATE TABLE token (
    token character varying,
    kind character varying,
    "channelId" character varying NOT NULL
);


ALTER TABLE token OWNER TO wolever;

--
-- Name: virtual_channel_state_updates_id_seq; Type: SEQUENCE; Schema: public; Owner: wolever
--

CREATE SEQUENCE virtual_channel_state_updates_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE virtual_channel_state_updates_id_seq OWNER TO wolever;

--
-- Name: virtual_channel_state_updates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: wolever
--

ALTER SEQUENCE virtual_channel_state_updates_id_seq OWNED BY virtual_channel_state_updates.id;


--
-- Name: virtual_channels_id_seq; Type: SEQUENCE; Schema: public; Owner: wolever
--

CREATE SEQUENCE virtual_channels_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE virtual_channels_id_seq OWNER TO wolever;

--
-- Name: virtual_channels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: wolever
--

ALTER SEQUENCE virtual_channels_id_seq OWNED BY virtual_channels.id;


--
-- Name: withdrawals; Type: TABLE; Schema: public; Owner: wolever
--

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


ALTER TABLE withdrawals OWNER TO wolever;

--
-- Name: withdrawals_id_seq; Type: SEQUENCE; Schema: public; Owner: wolever
--

CREATE SEQUENCE withdrawals_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE withdrawals_id_seq OWNER TO wolever;

--
-- Name: withdrawals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: wolever
--

ALTER SEQUENCE withdrawals_id_seq OWNED BY withdrawals.id;


--
-- Name: _cm_channel_updates id; Type: DEFAULT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY _cm_channel_updates ALTER COLUMN id SET DEFAULT nextval('_cm_channel_updates_id_seq'::regclass);


--
-- Name: _cm_channels id; Type: DEFAULT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY _cm_channels ALTER COLUMN id SET DEFAULT nextval('_cm_channels_id_seq'::regclass);


--
-- Name: applied_wallet_migrations id; Type: DEFAULT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY applied_wallet_migrations ALTER COLUMN id SET DEFAULT nextval('applied_wallet_migrations_id_seq'::regclass);


--
-- Name: applied_wallet_migrations migration_id; Type: DEFAULT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY applied_wallet_migrations ALTER COLUMN migration_id SET DEFAULT nextval('applied_wallet_migrations_migration_id_seq'::regclass);


--
-- Name: available_wallet_migrations id; Type: DEFAULT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY available_wallet_migrations ALTER COLUMN id SET DEFAULT nextval('available_wallet_migrations_id_seq'::regclass);


--
-- Name: chainsaw_channel_events id; Type: DEFAULT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY chainsaw_channel_events ALTER COLUMN id SET DEFAULT nextval('chainsaw_channel_events_id_seq'::regclass);


--
-- Name: chainsaw_channels id; Type: DEFAULT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY chainsaw_channels ALTER COLUMN id SET DEFAULT nextval('chainsaw_channels_id_seq'::regclass);


--
-- Name: chainsaw_events id; Type: DEFAULT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY chainsaw_events ALTER COLUMN id SET DEFAULT nextval('chainsaw_events_id_seq'::regclass);


--
-- Name: chainsaw_ledger_channels id; Type: DEFAULT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY chainsaw_ledger_channels ALTER COLUMN id SET DEFAULT nextval('chainsaw_ledger_channels_id_seq'::regclass);


--
-- Name: cm_thread_updates id; Type: DEFAULT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY cm_thread_updates ALTER COLUMN id SET DEFAULT nextval('cm_thread_updates_id_seq'::regclass);


--
-- Name: cm_threads id; Type: DEFAULT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY cm_threads ALTER COLUMN id SET DEFAULT nextval('cm_threads_id_seq'::regclass);


--
-- Name: disbursements id; Type: DEFAULT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY disbursements ALTER COLUMN id SET DEFAULT nextval('disbursements_id_seq'::regclass);


--
-- Name: exchange_rates id; Type: DEFAULT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY exchange_rates ALTER COLUMN id SET DEFAULT nextval('exchange_rates_id_seq'::regclass);


--
-- Name: gas_estimates id; Type: DEFAULT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY gas_estimates ALTER COLUMN id SET DEFAULT nextval('gas_estimates_id_seq'::regclass);


--
-- Name: ledger_channel_state_updates id; Type: DEFAULT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY ledger_channel_state_updates ALTER COLUMN id SET DEFAULT nextval('ledger_channel_state_updates_id_seq'::regclass);


--
-- Name: migrations id; Type: DEFAULT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY migrations ALTER COLUMN id SET DEFAULT nextval('migrations_id_seq'::regclass);


--
-- Name: virtual_channel_state_updates id; Type: DEFAULT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY virtual_channel_state_updates ALTER COLUMN id SET DEFAULT nextval('virtual_channel_state_updates_id_seq'::regclass);


--
-- Name: virtual_channels id; Type: DEFAULT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY virtual_channels ALTER COLUMN id SET DEFAULT nextval('virtual_channels_id_seq'::regclass);


--
-- Name: withdrawals id; Type: DEFAULT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY withdrawals ALTER COLUMN id SET DEFAULT nextval('withdrawals_id_seq'::regclass);


--
-- Data for Name: _cm_channel_updates; Type: TABLE DATA; Schema: public; Owner: wolever
--

COPY _cm_channel_updates (id, channel_id, created_on, reason, originator, hub_signed_on, user_signed_on, invalid, chainsaw_event_id, chainsaw_resolution_event_id, recipient, wei_balance_hub, wei_balance_user, token_balance_hub, token_balance_user, pending_wei_deposit_hub, pending_wei_deposit_user, pending_token_deposit_hub, pending_token_deposit_user, pending_wei_withdrawal_hub, pending_wei_withdrawal_user, pending_token_withdrawal_hub, pending_token_withdrawal_user, tx_count_global, tx_count_chain, thread_root, thread_count, timeout, sig_hub, sig_user) FROM stdin;
\.


--
-- Name: _cm_channel_updates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: wolever
--

SELECT pg_catalog.setval('_cm_channel_updates_id_seq', 1, false);


--
-- Data for Name: _cm_channels; Type: TABLE DATA; Schema: public; Owner: wolever
--

COPY _cm_channels (id, contract, hub, "user", status, recipient, wei_balance_hub, wei_balance_user, token_balance_user, token_balance_hub, pending_wei_deposit_hub, pending_wei_deposit_user, pending_token_deposit_hub, pending_token_deposit_user, pending_wei_withdrawal_hub, pending_wei_withdrawal_user, pending_token_withdrawal_hub, pending_token_withdrawal_user, tx_count_global, tx_count_chain, thread_root, thread_count, channel_dispute_event_id, channel_dispute_ends_on, channel_dispute_originator, thread_dispute_event_id, thread_dispute_ends_on, thread_dispute_originator) FROM stdin;
\.


--
-- Name: _cm_channels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: wolever
--

SELECT pg_catalog.setval('_cm_channels_id_seq', 1, false);


--
-- Data for Name: applied_wallet_migrations; Type: TABLE DATA; Schema: public; Owner: wolever
--

COPY applied_wallet_migrations (id, migration_id, wallet_address, applied_at) FROM stdin;
\.


--
-- Name: applied_wallet_migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: wolever
--

SELECT pg_catalog.setval('applied_wallet_migrations_id_seq', 1, false);


--
-- Name: applied_wallet_migrations_migration_id_seq; Type: SEQUENCE SET; Schema: public; Owner: wolever
--

SELECT pg_catalog.setval('applied_wallet_migrations_migration_id_seq', 1, false);


--
-- Data for Name: available_wallet_migrations; Type: TABLE DATA; Schema: public; Owner: wolever
--

COPY available_wallet_migrations (id, migration_name) FROM stdin;
1	close_channel
2	request_booty_disbursement
3	open_channel
4	exchange_booty
\.


--
-- Name: available_wallet_migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: wolever
--

SELECT pg_catalog.setval('available_wallet_migrations_id_seq', 4, true);


--
-- Data for Name: chainsaw_channel_events; Type: TABLE DATA; Schema: public; Owner: wolever
--

COPY chainsaw_channel_events (id, contract, channel_id, ts, block_number, block_hash, is_valid_block, sender, event_type, fields) FROM stdin;
\.


--
-- Name: chainsaw_channel_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: wolever
--

SELECT pg_catalog.setval('chainsaw_channel_events_id_seq', 1, false);


--
-- Data for Name: chainsaw_channels; Type: TABLE DATA; Schema: public; Owner: wolever
--

COPY chainsaw_channels (id, contract, channel_id, wei_value, status, opened_event_id, start_settling_event_id, settled_event_id, claim_event_id) FROM stdin;
\.


--
-- Data for Name: chainsaw_channels_deposits; Type: TABLE DATA; Schema: public; Owner: wolever
--

COPY chainsaw_channels_deposits (channel_id, deposit_event_id) FROM stdin;
\.


--
-- Name: chainsaw_channels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: wolever
--

SELECT pg_catalog.setval('chainsaw_channels_id_seq', 1, false);


--
-- Data for Name: chainsaw_events; Type: TABLE DATA; Schema: public; Owner: wolever
--

COPY chainsaw_events (id, contract, ts, block_number, block_hash, tx_hash, log_index, sender, channel_id, event_type, fields) FROM stdin;
\.


--
-- Name: chainsaw_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: wolever
--

SELECT pg_catalog.setval('chainsaw_events_id_seq', 1, false);


--
-- Data for Name: chainsaw_ledger_channels; Type: TABLE DATA; Schema: public; Owner: wolever
--

COPY chainsaw_ledger_channels (id, contract, channel_id, wei_balance_a_chain, wei_balance_i_chain, on_chain_nonce, vc_root_hash, num_open_vc, status, update_timeout, lc_opened_event_id, lc_joined_event_id, lc_start_settling_event_id, lc_closed_event_id, open_timeout, erc20_balance_a_chain, erc20_balance_i_chain, token) FROM stdin;
\.


--
-- Data for Name: chainsaw_ledger_channels_deposits; Type: TABLE DATA; Schema: public; Owner: wolever
--

COPY chainsaw_ledger_channels_deposits (channel_id, deposit_event_id, ledger_channel_state_updates_id) FROM stdin;
\.


--
-- Name: chainsaw_ledger_channels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: wolever
--

SELECT pg_catalog.setval('chainsaw_ledger_channels_id_seq', 1, false);


--
-- Data for Name: chainsaw_poll_events; Type: TABLE DATA; Schema: public; Owner: wolever
--

COPY chainsaw_poll_events (block_number, polled_at, contract, poll_type) FROM stdin;
\.


--
-- Data for Name: channel; Type: TABLE DATA; Schema: public; Owner: wolever
--

COPY channel ("channelId", kind, sender, receiver, value, spent, state, "contractAddress") FROM stdin;
\.


--
-- Data for Name: channel_claims; Type: TABLE DATA; Schema: public; Owner: wolever
--

COPY channel_claims (channel_id, status, createdat, pendingat, confirmedat, failedat) FROM stdin;
\.


--
-- Data for Name: cm_thread_updates; Type: TABLE DATA; Schema: public; Owner: wolever
--

COPY cm_thread_updates (id, thread_id, created_on, originator, sender_signed_on, wei_balance_sender, wei_balance_receiver, token_balance_sender, token_balance_receiver, tx_count, sig_sender) FROM stdin;
\.


--
-- Name: cm_thread_updates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: wolever
--

SELECT pg_catalog.setval('cm_thread_updates_id_seq', 1, false);


--
-- Data for Name: cm_threads; Type: TABLE DATA; Schema: public; Owner: wolever
--

COPY cm_threads (id, channel_id, "user", sender, receiver, in_dispute, wei_balance_sender, wei_balance_receiver, token_balance_sender, token_balance_receiver, tx_count, thread_dispute_event_id, thread_dispute_ends_on, thread_dispute_originator) FROM stdin;
\.


--
-- Name: cm_threads_id_seq; Type: SEQUENCE SET; Schema: public; Owner: wolever
--

SELECT pg_catalog.setval('cm_threads_id_seq', 1, false);


--
-- Data for Name: disbursements; Type: TABLE DATA; Schema: public; Owner: wolever
--

COPY disbursements (id, recipient, amountwei, txhash, status, createdat, pendingat, confirmedat, failedat, amounterc20) FROM stdin;
\.


--
-- Name: disbursements_id_seq; Type: SEQUENCE SET; Schema: public; Owner: wolever
--

SELECT pg_catalog.setval('disbursements_id_seq', 1, false);


--
-- Data for Name: exchange_rates; Type: TABLE DATA; Schema: public; Owner: wolever
--

COPY exchange_rates (id, retrievedat, base, rate_usd) FROM stdin;
\.


--
-- Name: exchange_rates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: wolever
--

SELECT pg_catalog.setval('exchange_rates_id_seq', 1, false);


--
-- Data for Name: feature_flags; Type: TABLE DATA; Schema: public; Owner: wolever
--

COPY feature_flags (address, booty_support) FROM stdin;
0x0000000000000000000000000000000000000000	f
\.


--
-- Data for Name: gas_estimates; Type: TABLE DATA; Schema: public; Owner: wolever
--

COPY gas_estimates (id, retrieved_at, speed, block_num, block_time, fastest, fastest_wait, fast, fast_wait, average, avg_wait, safe_low, safe_low_wait) FROM stdin;
\.


--
-- Name: gas_estimates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: wolever
--

SELECT pg_catalog.setval('gas_estimates_id_seq', 1, false);


--
-- Data for Name: global_settings; Type: TABLE DATA; Schema: public; Owner: wolever
--

COPY global_settings (withdrawals_enabled, payments_enabled) FROM stdin;
t	t
\.


--
-- Data for Name: ledger_channel_state_updates; Type: TABLE DATA; Schema: public; Owner: wolever
--

COPY ledger_channel_state_updates (id, is_close, channel_id, nonce, open_vcs, vc_root_hash, wei_balance_a, wei_balance_i, reason, vc_id, sig_a, sig_i, exchange_rate_id, price_wei, erc20_balance_a, erc20_balance_i, created_at, price_erc20) FROM stdin;
\.


--
-- Name: ledger_channel_state_updates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: wolever
--

SELECT pg_catalog.setval('ledger_channel_state_updates_id_seq', 1, false);


--
-- Data for Name: migrations; Type: TABLE DATA; Schema: public; Owner: wolever
--

COPY migrations (id, name, run_on) FROM stdin;
1	/20180115082440-create-channel	2018-10-25 23:02:32.626
2	/20180115082512-create-token	2018-10-25 23:02:32.641
3	/20180115082606-create-payment	2018-10-25 23:02:32.649
4	/20180325060555-add-created-at	2018-10-25 23:02:32.656
5	/20180218094628-add-tips	2018-10-25 23:02:33.269
6	/20180302055918-add-tip-created-at	2018-10-25 23:02:33.277
7	/20180314202906-add-exchange-rates	2018-10-25 23:02:33.284
8	/20180314202957-add-withdrawals	2018-10-25 23:02:33.346
9	/20180320191317-link-exchange-rates-to-payment	2018-10-25 23:02:33.417
10	/20180320204043-add-withdrawal-id-to-payment	2018-10-25 23:02:33.426
11	/20180320214117-add-payments-view	2018-10-25 23:02:33.468
12	/20180320222159-add-create-withdrawal-function	2018-10-25 23:02:33.492
13	/20180321052252-add-global-settings	2018-10-25 23:02:33.498
14	/20180401204153-add-channel-claims	2018-10-25 23:02:33.539
15	/20180411164325-add-payment-meta	2018-10-25 23:02:33.546
16	/20180412185845-migrate-tips-to-meta	2018-10-25 23:02:33.613
17	/20180426191933-add-ether-wd-mode	2018-10-25 23:02:33.634
18	/20180504181012-fix-wd-tip-assignment	2018-10-25 23:02:33.682
19	/20180508181228-add-chainsaw-poll-events	2018-10-25 23:02:33.69
20	/20180508212250-add-chainsaw-channel-events	2018-10-25 23:02:33.758
21	/20180508222916-add-chainsaw-channels-and-trigger	2018-10-25 23:02:33.831
22	/20180509224829-add-hub-channels	2018-10-25 23:02:33.841
23	/20180608225745-add-chainsaw-ledger-channels-virtual-channels-and-trigger	2018-10-25 23:02:33.871
24	/20180612002837-add-virtual-channels	2018-10-25 23:02:33.883
25	/20180612234326-add-new-event-types	2018-10-25 23:02:33.938
26	/20180613224303-add-vc-state-updates	2018-10-25 23:02:33.952
27	/20180613230808-add-hub-virtual-channels	2018-10-25 23:02:33.964
28	/20180614034058-add-lc-state-updates	2018-10-25 23:02:34.019
29	/20180713230146-change-virtual-channel-column-name	2018-10-25 23:02:34.022
30	/20180719201026-add-channel-timeouts	2018-10-25 23:02:34.043
31	/20180719235522-new-payments-meta	2018-10-25 23:02:34.055
32	/20180726013729-add-lc-update-reason	2018-10-25 23:02:34.058
33	/20180726174203-vc-and-lc-payments	2018-10-25 23:02:34.081
34	/20180728014548-unique-nonce	2018-10-25 23:02:34.089
35	/20180730224815-disbursement	2018-10-25 23:02:34.101
36	/20180807201157-lc-erc20-fields	2018-10-25 23:02:34.113
37	/20180808195305-hub-lc-channel-view	2018-10-25 23:02:34.128
38	/20180809000852-vc-add-erc20	2018-10-25 23:02:34.135
39	/20180811101010-add-gas-estimate	2018-10-25 23:02:34.141
40	/20180824185129-add-channel-disbursements	2018-10-25 23:02:34.153
41	/20180830204410-add-created-at-to-vcus	2018-10-25 23:02:34.175
42	/20180914100923-add-feature-flags	2018-10-25 23:02:34.181
43	/20180925042553-add-ledger-channel-state-updates-created-at	2018-10-25 23:02:34.185
44	/20180927171546-add-wallet-migration-tables	2018-10-25 23:02:34.199
45	/20180927190000-add-booty-prices	2018-10-25 23:02:34.218
46	/20180927204928-add-purchase-id-to-payments	2018-10-25 23:02:34.235
47	/20180928013844-correlate-deposit	2018-10-25 23:02:34.24
48	/20180928214204-support-erc20-disbursement	2018-10-25 23:02:34.245
49	/20180930013025-add-payment-indexes	2018-10-25 23:02:34.255
50	/20181003201117-add-default-feature-flags-row	2018-10-25 23:02:34.259
51	/20181004092401-fix-payments-created-at	2018-10-25 23:02:34.272
52	/20181004195202-payment-meta-purchase-remove-unique	2018-10-25 23:02:34.276
\.


--
-- Name: migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: wolever
--

SELECT pg_catalog.setval('migrations_id_seq', 52, true);


--
-- Data for Name: payment; Type: TABLE DATA; Schema: public; Owner: wolever
--

COPY payment ("channelId", kind, token, sender, receiver, price, value, "channelValue", v, r, s, meta, "contractAddress", "createdAt", exchange_rate_id, withdrawal_id) FROM stdin;
\.


--
-- Data for Name: payment_meta; Type: TABLE DATA; Schema: public; Owner: wolever
--

COPY payment_meta (paymenttoken, receiver, type, fields, vcupdatetoken, lcupdatetoken, purchase) FROM stdin;
\.


--
-- Data for Name: token; Type: TABLE DATA; Schema: public; Owner: wolever
--

COPY token (token, kind, "channelId") FROM stdin;
\.


--
-- Data for Name: virtual_channel_state_updates; Type: TABLE DATA; Schema: public; Owner: wolever
--

COPY virtual_channel_state_updates (id, channel_id, nonce, wei_balance_a, wei_balance_b, sig_a, sig_b, exchange_rate_id, price_wei, erc20_balance_a, erc20_balance_b, created_at, price_erc20) FROM stdin;
\.


--
-- Name: virtual_channel_state_updates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: wolever
--

SELECT pg_catalog.setval('virtual_channel_state_updates_id_seq', 1, false);


--
-- Data for Name: virtual_channels; Type: TABLE DATA; Schema: public; Owner: wolever
--

COPY virtual_channels (id, channel_id, party_a, party_b, party_i, subchan_a_to_i, subchan_b_to_i, status, on_chain_nonce, update_timeout, vc_init_event_id, vc_start_settling_event_id, vc_settled_event_id) FROM stdin;
\.


--
-- Name: virtual_channels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: wolever
--

SELECT pg_catalog.setval('virtual_channels_id_seq', 1, false);


--
-- Data for Name: withdrawals; Type: TABLE DATA; Schema: public; Owner: wolever
--

COPY withdrawals (id, recipient, amountwei, amountusd, txhash, status, exchange_rate_id, createdat, pendingat, confirmedat, failedat, method, initiator) FROM stdin;
\.


--
-- Name: withdrawals_id_seq; Type: SEQUENCE SET; Schema: public; Owner: wolever
--

SELECT pg_catalog.setval('withdrawals_id_seq', 1, false);


--
-- Name: _cm_channel_updates _cm_channel_updates_pkey; Type: CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY _cm_channel_updates
    ADD CONSTRAINT _cm_channel_updates_pkey PRIMARY KEY (id);


--
-- Name: _cm_channels _cm_channels_pkey; Type: CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY _cm_channels
    ADD CONSTRAINT _cm_channels_pkey PRIMARY KEY (id);


--
-- Name: applied_wallet_migrations applied_wallet_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY applied_wallet_migrations
    ADD CONSTRAINT applied_wallet_migrations_pkey PRIMARY KEY (id);


--
-- Name: available_wallet_migrations available_wallet_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY available_wallet_migrations
    ADD CONSTRAINT available_wallet_migrations_pkey PRIMARY KEY (id);


--
-- Name: chainsaw_channel_events chainsaw_channel_events_pkey; Type: CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY chainsaw_channel_events
    ADD CONSTRAINT chainsaw_channel_events_pkey PRIMARY KEY (id);


--
-- Name: chainsaw_channels chainsaw_channels_channel_id_key; Type: CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY chainsaw_channels
    ADD CONSTRAINT chainsaw_channels_channel_id_key UNIQUE (channel_id);


--
-- Name: chainsaw_channels chainsaw_channels_pkey; Type: CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY chainsaw_channels
    ADD CONSTRAINT chainsaw_channels_pkey PRIMARY KEY (id);


--
-- Name: chainsaw_events chainsaw_events_pkey; Type: CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY chainsaw_events
    ADD CONSTRAINT chainsaw_events_pkey PRIMARY KEY (id);


--
-- Name: chainsaw_ledger_channels chainsaw_ledger_channels_channel_id_key; Type: CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY chainsaw_ledger_channels
    ADD CONSTRAINT chainsaw_ledger_channels_channel_id_key UNIQUE (channel_id);


--
-- Name: chainsaw_ledger_channels chainsaw_ledger_channels_pkey; Type: CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY chainsaw_ledger_channels
    ADD CONSTRAINT chainsaw_ledger_channels_pkey PRIMARY KEY (id);


--
-- Name: chainsaw_poll_events chainsaw_poll_events_block_number_key; Type: CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY chainsaw_poll_events
    ADD CONSTRAINT chainsaw_poll_events_block_number_key UNIQUE (block_number);


--
-- Name: channel channel_pkey; Type: CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY channel
    ADD CONSTRAINT channel_pkey PRIMARY KEY ("channelId");


--
-- Name: cm_thread_updates cm_thread_updates_pkey; Type: CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY cm_thread_updates
    ADD CONSTRAINT cm_thread_updates_pkey PRIMARY KEY (id);


--
-- Name: cm_threads cm_threads_pkey; Type: CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY cm_threads
    ADD CONSTRAINT cm_threads_pkey PRIMARY KEY (id);


--
-- Name: disbursements disbursements_pkey; Type: CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY disbursements
    ADD CONSTRAINT disbursements_pkey PRIMARY KEY (id);


--
-- Name: exchange_rates exchange_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY exchange_rates
    ADD CONSTRAINT exchange_rates_pkey PRIMARY KEY (id);


--
-- Name: gas_estimates gas_estimates_block_num_key; Type: CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY gas_estimates
    ADD CONSTRAINT gas_estimates_block_num_key UNIQUE (block_num);


--
-- Name: gas_estimates gas_estimates_pkey; Type: CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY gas_estimates
    ADD CONSTRAINT gas_estimates_pkey PRIMARY KEY (id);


--
-- Name: ledger_channel_state_updates ledger_channel_state_updates_channel_id_nonce_key; Type: CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY ledger_channel_state_updates
    ADD CONSTRAINT ledger_channel_state_updates_channel_id_nonce_key UNIQUE (channel_id, nonce);


--
-- Name: ledger_channel_state_updates ledger_channel_state_updates_pkey; Type: CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY ledger_channel_state_updates
    ADD CONSTRAINT ledger_channel_state_updates_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: payment payment_token_key; Type: CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY payment
    ADD CONSTRAINT payment_token_key UNIQUE (token);


--
-- Name: virtual_channel_state_updates virtual_channel_state_updates_channel_id_nonce_key; Type: CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY virtual_channel_state_updates
    ADD CONSTRAINT virtual_channel_state_updates_channel_id_nonce_key UNIQUE (channel_id, nonce);


--
-- Name: virtual_channel_state_updates virtual_channel_state_updates_pkey; Type: CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY virtual_channel_state_updates
    ADD CONSTRAINT virtual_channel_state_updates_pkey PRIMARY KEY (id);


--
-- Name: virtual_channels virtual_channels_channel_id_key; Type: CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY virtual_channels
    ADD CONSTRAINT virtual_channels_channel_id_key UNIQUE (channel_id);


--
-- Name: virtual_channels virtual_channels_pkey; Type: CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY virtual_channels
    ADD CONSTRAINT virtual_channels_pkey PRIMARY KEY (id);


--
-- Name: withdrawals withdrawals_pkey; Type: CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY withdrawals
    ADD CONSTRAINT withdrawals_pkey PRIMARY KEY (id);


--
-- Name: chainsaw_events_tx_hash_log_index; Type: INDEX; Schema: public; Owner: wolever
--

CREATE UNIQUE INDEX chainsaw_events_tx_hash_log_index ON chainsaw_events USING btree (tx_hash, log_index);


--
-- Name: channel_claims_channel_id; Type: INDEX; Schema: public; Owner: wolever
--

CREATE INDEX channel_claims_channel_id ON channel_claims USING btree (channel_id);


--
-- Name: cm_channel_updates_channel_txcount_unique; Type: INDEX; Schema: public; Owner: wolever
--

CREATE UNIQUE INDEX cm_channel_updates_channel_txcount_unique ON _cm_channel_updates USING btree (channel_id, tx_count_global) WHERE (invalid IS NULL);


--
-- Name: cm_channels_contract_user; Type: INDEX; Schema: public; Owner: wolever
--

CREATE UNIQUE INDEX cm_channels_contract_user ON _cm_channels USING btree (contract, "user");


--
-- Name: cm_thread_updates_thread_txcount_unique; Type: INDEX; Schema: public; Owner: wolever
--

CREATE UNIQUE INDEX cm_thread_updates_thread_txcount_unique ON cm_thread_updates USING btree (thread_id, tx_count);


--
-- Name: disbursements_recipient; Type: INDEX; Schema: public; Owner: wolever
--

CREATE INDEX disbursements_recipient ON disbursements USING btree (recipient);


--
-- Name: feature_flags_address; Type: INDEX; Schema: public; Owner: wolever
--

CREATE UNIQUE INDEX feature_flags_address ON feature_flags USING btree (address);


--
-- Name: ledger_channel_state_updates_exchange_rate_idx; Type: INDEX; Schema: public; Owner: wolever
--

CREATE INDEX ledger_channel_state_updates_exchange_rate_idx ON ledger_channel_state_updates USING btree (exchange_rate_id);


--
-- Name: ledger_channel_state_updates_nonce_idx; Type: INDEX; Schema: public; Owner: wolever
--

CREATE INDEX ledger_channel_state_updates_nonce_idx ON ledger_channel_state_updates USING btree (nonce);


--
-- Name: payment_channelid_idx; Type: INDEX; Schema: public; Owner: wolever
--

CREATE INDEX payment_channelid_idx ON payment USING btree ("channelId");


--
-- Name: payment_exchange_rate_idx; Type: INDEX; Schema: public; Owner: wolever
--

CREATE INDEX payment_exchange_rate_idx ON payment USING btree (exchange_rate_id);


--
-- Name: payment_meta_lcupdatetoken; Type: INDEX; Schema: public; Owner: wolever
--

CREATE UNIQUE INDEX payment_meta_lcupdatetoken ON payment_meta USING btree (lcupdatetoken);


--
-- Name: payment_meta_paymenttoken; Type: INDEX; Schema: public; Owner: wolever
--

CREATE UNIQUE INDEX payment_meta_paymenttoken ON payment_meta USING btree (paymenttoken);


--
-- Name: payment_meta_purchase; Type: INDEX; Schema: public; Owner: wolever
--

CREATE INDEX payment_meta_purchase ON payment_meta USING btree (purchase);


--
-- Name: payment_meta_vcupdatetoken; Type: INDEX; Schema: public; Owner: wolever
--

CREATE UNIQUE INDEX payment_meta_vcupdatetoken ON payment_meta USING btree (vcupdatetoken);


--
-- Name: payment_receiver; Type: INDEX; Schema: public; Owner: wolever
--

CREATE INDEX payment_receiver ON payment USING btree (receiver);


--
-- Name: payment_sender; Type: INDEX; Schema: public; Owner: wolever
--

CREATE INDEX payment_sender ON payment USING btree (sender);


--
-- Name: payment_withdrawal_id; Type: INDEX; Schema: public; Owner: wolever
--

CREATE INDEX payment_withdrawal_id ON payment USING btree (withdrawal_id);


--
-- Name: require_single_pending; Type: INDEX; Schema: public; Owner: wolever
--

CREATE UNIQUE INDEX require_single_pending ON withdrawals USING btree (recipient) WHERE ((status = 'NEW'::withdrawal_status) OR (status = 'PENDING'::withdrawal_status));


--
-- Name: require_single_pending_channel_claim; Type: INDEX; Schema: public; Owner: wolever
--

CREATE UNIQUE INDEX require_single_pending_channel_claim ON channel_claims USING btree (channel_id) WHERE ((status = 'NEW'::channel_claim_status) OR (status = 'PENDING'::channel_claim_status) OR (status = 'CONFIRMED'::channel_claim_status));


--
-- Name: require_single_pending_disbursement; Type: INDEX; Schema: public; Owner: wolever
--

CREATE UNIQUE INDEX require_single_pending_disbursement ON disbursements USING btree (recipient) WHERE ((status = 'NEW'::disbursements_status) OR (status = 'PENDING'::disbursements_status));


--
-- Name: virtual_channel_state_updates_channel_id; Type: INDEX; Schema: public; Owner: wolever
--

CREATE INDEX virtual_channel_state_updates_channel_id ON virtual_channel_state_updates USING btree (channel_id);


--
-- Name: virtual_channel_state_updates_exchange_rate_idx; Type: INDEX; Schema: public; Owner: wolever
--

CREATE INDEX virtual_channel_state_updates_exchange_rate_idx ON virtual_channel_state_updates USING btree (exchange_rate_id);


--
-- Name: virtual_channel_state_updates_nonce_idx; Type: INDEX; Schema: public; Owner: wolever
--

CREATE INDEX virtual_channel_state_updates_nonce_idx ON virtual_channel_state_updates USING btree (nonce);


--
-- Name: virtual_channels_channel_id; Type: INDEX; Schema: public; Owner: wolever
--

CREATE INDEX virtual_channels_channel_id ON virtual_channels USING btree (channel_id);


--
-- Name: virtual_channels_party_a; Type: INDEX; Schema: public; Owner: wolever
--

CREATE INDEX virtual_channels_party_a ON virtual_channels USING btree (party_a);


--
-- Name: virtual_channels_party_b; Type: INDEX; Schema: public; Owner: wolever
--

CREATE INDEX virtual_channels_party_b ON virtual_channels USING btree (party_b);


--
-- Name: virtual_channels_party_i; Type: INDEX; Schema: public; Owner: wolever
--

CREATE INDEX virtual_channels_party_i ON virtual_channels USING btree (party_i);


--
-- Name: withdrawals_recipient; Type: INDEX; Schema: public; Owner: wolever
--

CREATE INDEX withdrawals_recipient ON withdrawals USING btree (recipient);


--
-- Name: _cm_channels cm_channels_check_update_trigger; Type: TRIGGER; Schema: public; Owner: wolever
--

CREATE TRIGGER cm_channels_check_update_trigger BEFORE UPDATE ON _cm_channels FOR EACH ROW EXECUTE PROCEDURE cm_channels_check_update_trigger();


--
-- Name: cm_threads cm_threads_check_update_trigger; Type: TRIGGER; Schema: public; Owner: wolever
--

CREATE TRIGGER cm_threads_check_update_trigger BEFORE UPDATE ON cm_threads FOR EACH ROW EXECUTE PROCEDURE cm_threads_check_update_trigger();


--
-- Name: chainsaw_channel_events materialize_chainsaw_channel; Type: TRIGGER; Schema: public; Owner: wolever
--

CREATE TRIGGER materialize_chainsaw_channel AFTER INSERT ON chainsaw_channel_events FOR EACH ROW EXECUTE PROCEDURE materialize_chainsaw_channel();


--
-- Name: chainsaw_channel_events materialize_chainsaw_ledger_channel; Type: TRIGGER; Schema: public; Owner: wolever
--

CREATE TRIGGER materialize_chainsaw_ledger_channel AFTER INSERT ON chainsaw_channel_events FOR EACH ROW EXECUTE PROCEDURE materialize_chainsaw_ledger_channel();


--
-- Name: payment stamp_exchange_rate; Type: TRIGGER; Schema: public; Owner: wolever
--

CREATE TRIGGER stamp_exchange_rate BEFORE INSERT ON payment FOR EACH ROW EXECUTE PROCEDURE stamp_exchange_rate();


--
-- Name: virtual_channel_state_updates stamp_exchange_rate; Type: TRIGGER; Schema: public; Owner: wolever
--

CREATE TRIGGER stamp_exchange_rate BEFORE INSERT ON virtual_channel_state_updates FOR EACH ROW EXECUTE PROCEDURE stamp_exchange_rate();


--
-- Name: ledger_channel_state_updates stamp_exchange_rate; Type: TRIGGER; Schema: public; Owner: wolever
--

CREATE TRIGGER stamp_exchange_rate BEFORE INSERT ON ledger_channel_state_updates FOR EACH ROW EXECUTE PROCEDURE stamp_exchange_rate();


--
-- Name: disbursements stamp_now; Type: TRIGGER; Schema: public; Owner: wolever
--

CREATE TRIGGER stamp_now BEFORE INSERT ON disbursements FOR EACH ROW EXECUTE PROCEDURE disburesment_stamp_now();


--
-- Name: withdrawals validate_status; Type: TRIGGER; Schema: public; Owner: wolever
--

CREATE TRIGGER validate_status BEFORE UPDATE ON withdrawals FOR EACH ROW EXECUTE PROCEDURE validate_status();


--
-- Name: disbursements validate_status; Type: TRIGGER; Schema: public; Owner: wolever
--

CREATE TRIGGER validate_status BEFORE UPDATE ON disbursements FOR EACH ROW EXECUTE PROCEDURE validate_disbursement_status();


--
-- Name: channel_claims validate_status_channel_claims; Type: TRIGGER; Schema: public; Owner: wolever
--

CREATE TRIGGER validate_status_channel_claims BEFORE UPDATE ON channel_claims FOR EACH ROW EXECUTE PROCEDURE validate_status();


--
-- Name: _cm_channel_updates _cm_channel_updates_chainsaw_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY _cm_channel_updates
    ADD CONSTRAINT _cm_channel_updates_chainsaw_event_id_fkey FOREIGN KEY (chainsaw_event_id) REFERENCES chainsaw_events(id);


--
-- Name: _cm_channel_updates _cm_channel_updates_chainsaw_resolution_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY _cm_channel_updates
    ADD CONSTRAINT _cm_channel_updates_chainsaw_resolution_event_id_fkey FOREIGN KEY (chainsaw_resolution_event_id) REFERENCES chainsaw_events(id);


--
-- Name: _cm_channel_updates _cm_channel_updates_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY _cm_channel_updates
    ADD CONSTRAINT _cm_channel_updates_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES _cm_channels(id);


--
-- Name: _cm_channels _cm_channels_channel_dispute_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY _cm_channels
    ADD CONSTRAINT _cm_channels_channel_dispute_event_id_fkey FOREIGN KEY (channel_dispute_event_id) REFERENCES chainsaw_events(id);


--
-- Name: _cm_channels _cm_channels_thread_dispute_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY _cm_channels
    ADD CONSTRAINT _cm_channels_thread_dispute_event_id_fkey FOREIGN KEY (thread_dispute_event_id) REFERENCES chainsaw_events(id);


--
-- Name: applied_wallet_migrations applied_wallet_migrations_migration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY applied_wallet_migrations
    ADD CONSTRAINT applied_wallet_migrations_migration_id_fkey FOREIGN KEY (migration_id) REFERENCES available_wallet_migrations(id);


--
-- Name: chainsaw_channels chainsaw_channels_claim_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY chainsaw_channels
    ADD CONSTRAINT chainsaw_channels_claim_event_id_fkey FOREIGN KEY (claim_event_id) REFERENCES chainsaw_channel_events(id);


--
-- Name: chainsaw_channels_deposits chainsaw_channels_deposits_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY chainsaw_channels_deposits
    ADD CONSTRAINT chainsaw_channels_deposits_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES chainsaw_channels(channel_id);


--
-- Name: chainsaw_channels_deposits chainsaw_channels_deposits_deposit_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY chainsaw_channels_deposits
    ADD CONSTRAINT chainsaw_channels_deposits_deposit_event_id_fkey FOREIGN KEY (deposit_event_id) REFERENCES chainsaw_channel_events(id);


--
-- Name: chainsaw_channels chainsaw_channels_opened_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY chainsaw_channels
    ADD CONSTRAINT chainsaw_channels_opened_event_id_fkey FOREIGN KEY (opened_event_id) REFERENCES chainsaw_channel_events(id);


--
-- Name: chainsaw_channels chainsaw_channels_settled_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY chainsaw_channels
    ADD CONSTRAINT chainsaw_channels_settled_event_id_fkey FOREIGN KEY (settled_event_id) REFERENCES chainsaw_channel_events(id);


--
-- Name: chainsaw_channels chainsaw_channels_start_settling_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY chainsaw_channels
    ADD CONSTRAINT chainsaw_channels_start_settling_event_id_fkey FOREIGN KEY (start_settling_event_id) REFERENCES chainsaw_channel_events(id);


--
-- Name: chainsaw_ledger_channels_deposits chainsaw_ledger_channels_depo_ledger_channel_state_updates_fkey; Type: FK CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY chainsaw_ledger_channels_deposits
    ADD CONSTRAINT chainsaw_ledger_channels_depo_ledger_channel_state_updates_fkey FOREIGN KEY (ledger_channel_state_updates_id) REFERENCES ledger_channel_state_updates(id);


--
-- Name: chainsaw_ledger_channels_deposits chainsaw_ledger_channels_deposits_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY chainsaw_ledger_channels_deposits
    ADD CONSTRAINT chainsaw_ledger_channels_deposits_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES chainsaw_ledger_channels(channel_id);


--
-- Name: chainsaw_ledger_channels_deposits chainsaw_ledger_channels_deposits_deposit_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY chainsaw_ledger_channels_deposits
    ADD CONSTRAINT chainsaw_ledger_channels_deposits_deposit_event_id_fkey FOREIGN KEY (deposit_event_id) REFERENCES chainsaw_channel_events(id);


--
-- Name: chainsaw_ledger_channels chainsaw_ledger_channels_lc_closed_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY chainsaw_ledger_channels
    ADD CONSTRAINT chainsaw_ledger_channels_lc_closed_event_id_fkey FOREIGN KEY (lc_closed_event_id) REFERENCES chainsaw_channel_events(id);


--
-- Name: chainsaw_ledger_channels chainsaw_ledger_channels_lc_joined_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY chainsaw_ledger_channels
    ADD CONSTRAINT chainsaw_ledger_channels_lc_joined_event_id_fkey FOREIGN KEY (lc_joined_event_id) REFERENCES chainsaw_channel_events(id);


--
-- Name: chainsaw_ledger_channels chainsaw_ledger_channels_lc_opened_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY chainsaw_ledger_channels
    ADD CONSTRAINT chainsaw_ledger_channels_lc_opened_event_id_fkey FOREIGN KEY (lc_opened_event_id) REFERENCES chainsaw_channel_events(id);


--
-- Name: chainsaw_ledger_channels chainsaw_ledger_channels_lc_start_settling_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY chainsaw_ledger_channels
    ADD CONSTRAINT chainsaw_ledger_channels_lc_start_settling_event_id_fkey FOREIGN KEY (lc_start_settling_event_id) REFERENCES chainsaw_channel_events(id);


--
-- Name: channel_claims channel_claims_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY channel_claims
    ADD CONSTRAINT channel_claims_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES channel("channelId");


--
-- Name: chainsaw_events channel_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY chainsaw_events
    ADD CONSTRAINT channel_id_fk FOREIGN KEY (channel_id) REFERENCES _cm_channels(id);


--
-- Name: cm_thread_updates cm_thread_updates_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY cm_thread_updates
    ADD CONSTRAINT cm_thread_updates_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES cm_threads(id);


--
-- Name: cm_threads cm_threads_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY cm_threads
    ADD CONSTRAINT cm_threads_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES _cm_channels(id);


--
-- Name: cm_threads cm_threads_thread_dispute_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY cm_threads
    ADD CONSTRAINT cm_threads_thread_dispute_event_id_fkey FOREIGN KEY (thread_dispute_event_id) REFERENCES chainsaw_events(id);


--
-- Name: ledger_channel_state_updates ledger_channel_state_updates_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY ledger_channel_state_updates
    ADD CONSTRAINT ledger_channel_state_updates_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES chainsaw_ledger_channels(channel_id);


--
-- Name: ledger_channel_state_updates ledger_channel_state_updates_exchange_rate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY ledger_channel_state_updates
    ADD CONSTRAINT ledger_channel_state_updates_exchange_rate_id_fkey FOREIGN KEY (exchange_rate_id) REFERENCES exchange_rates(id);


--
-- Name: ledger_channel_state_updates ledger_channel_state_updates_vc_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY ledger_channel_state_updates
    ADD CONSTRAINT ledger_channel_state_updates_vc_id_fkey FOREIGN KEY (vc_id) REFERENCES virtual_channels(channel_id);


--
-- Name: payment payment_exchange_rate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY payment
    ADD CONSTRAINT payment_exchange_rate_id_fkey FOREIGN KEY (exchange_rate_id) REFERENCES exchange_rates(id);


--
-- Name: payment_meta payment_meta_lcupdatetoken_fkey; Type: FK CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY payment_meta
    ADD CONSTRAINT payment_meta_lcupdatetoken_fkey FOREIGN KEY (lcupdatetoken) REFERENCES ledger_channel_state_updates(id);


--
-- Name: payment_meta payment_meta_paymenttoken_fkey; Type: FK CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY payment_meta
    ADD CONSTRAINT payment_meta_paymenttoken_fkey FOREIGN KEY (paymenttoken) REFERENCES payment(token);


--
-- Name: payment_meta payment_meta_vcupdatetoken_fkey; Type: FK CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY payment_meta
    ADD CONSTRAINT payment_meta_vcupdatetoken_fkey FOREIGN KEY (vcupdatetoken) REFERENCES virtual_channel_state_updates(id);


--
-- Name: payment payment_withdrawal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY payment
    ADD CONSTRAINT payment_withdrawal_id_fkey FOREIGN KEY (withdrawal_id) REFERENCES withdrawals(id);


--
-- Name: token tokens_channel_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY token
    ADD CONSTRAINT tokens_channel_id_fk FOREIGN KEY ("channelId") REFERENCES channel("channelId") ON DELETE CASCADE;


--
-- Name: payment tokens_channel_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY payment
    ADD CONSTRAINT tokens_channel_id_fk FOREIGN KEY ("channelId") REFERENCES channel("channelId") ON DELETE CASCADE;


--
-- Name: virtual_channel_state_updates virtual_channel_state_updates_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY virtual_channel_state_updates
    ADD CONSTRAINT virtual_channel_state_updates_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES virtual_channels(channel_id);


--
-- Name: virtual_channel_state_updates virtual_channel_state_updates_exchange_rate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY virtual_channel_state_updates
    ADD CONSTRAINT virtual_channel_state_updates_exchange_rate_id_fkey FOREIGN KEY (exchange_rate_id) REFERENCES exchange_rates(id);


--
-- Name: virtual_channels virtual_channels_subchan_a_to_i_fkey; Type: FK CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY virtual_channels
    ADD CONSTRAINT virtual_channels_subchan_a_to_i_fkey FOREIGN KEY (subchan_a_to_i) REFERENCES chainsaw_ledger_channels(channel_id);


--
-- Name: virtual_channels virtual_channels_subchan_b_to_i_fkey; Type: FK CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY virtual_channels
    ADD CONSTRAINT virtual_channels_subchan_b_to_i_fkey FOREIGN KEY (subchan_b_to_i) REFERENCES chainsaw_ledger_channels(channel_id);


--
-- Name: virtual_channels virtual_channels_vc_init_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY virtual_channels
    ADD CONSTRAINT virtual_channels_vc_init_event_id_fkey FOREIGN KEY (vc_init_event_id) REFERENCES chainsaw_channel_events(id);


--
-- Name: virtual_channels virtual_channels_vc_settled_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY virtual_channels
    ADD CONSTRAINT virtual_channels_vc_settled_event_id_fkey FOREIGN KEY (vc_settled_event_id) REFERENCES chainsaw_channel_events(id);


--
-- Name: virtual_channels virtual_channels_vc_start_settling_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY virtual_channels
    ADD CONSTRAINT virtual_channels_vc_start_settling_event_id_fkey FOREIGN KEY (vc_start_settling_event_id) REFERENCES chainsaw_channel_events(id);


--
-- Name: withdrawals withdrawals_exchange_rate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY withdrawals
    ADD CONSTRAINT withdrawals_exchange_rate_id_fkey FOREIGN KEY (exchange_rate_id) REFERENCES exchange_rates(id);


--
-- PostgreSQL database dump complete
--

