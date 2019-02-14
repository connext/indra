-- Deposit addresses allocated to users
create table coinpayments_deposit_addresses (
  id bigserial primary key,
  created_on timestamp with time zone not null default now(),
  "user" csw_eth_address not null,
  currency text not null, -- BTC, LTC, etc
  address text not null,
  pubkey text, -- as returned by the API
  dest_tag text -- as returned by the api
);

-- A row is added here each time we recieve an IPN
create table coinpayments_ipns (
  id bigserial primary key,
  created_on timestamp with time zone not null default now(),
  "user" csw_eth_address, -- the IPN URL will include the user's address
  ipn_id text unique not null,
  status integer not null, -- payment status from CoinPayments API; >= 100 = success
  status_text text not null,
  currency text not null, -- currency paid by the user
  currency_fiat text not null, -- 'USD', etc
  address text not null, -- the address that received the payment
  amount numeric not null, -- amount in source currency
  amount_fiat numeric not null,
  fee numeric not null, -- fee taken by CoinPayments, in source currency
  fee_fiat numeric not null, -- fee taken by CoinPayments, in fiat
  data jsonb not null -- the raw data sent by the IPN (CoinPaymentsIpnData)
);

-- The payout from CoinPayments -> the user
create table _coinpayments_user_credits (
  id bigserial primary key,
  created_on timestamp with time zone not null default now(),
  ipn_id bigint not null unique references coinpayments_ipns(id),

  -- The ProposePending update where the hub is attempting to
  -- deposit into the user's channel. Null if one has not been proposed yet
  -- (for example, because the channel already has pending operations).
  -- Note: we can reference the onchain transaction through
  -- the update row.
  -- Additionally, for the moment, we should introduce a trigger
  -- which prevents removing (via deletion or invalidation)
  -- this update to make sure the user actually gets paid.
  -- In the future we'll no doubt want to relax this constraint
  -- and introduce some logic to handle that situation.
  -- Re. ON DELETE RESTRICT: see comments in coinpayments_ensure_payment_update_is_not_invalidated
  propose_pending_id bigint unique references _cm_channel_updates(id) on delete restrict
);

create view coinpayments_user_credits as (
  select
    credit.id,
    credit.created_on,
    credit.ipn_id,
    ipn.user,
    credit.propose_pending_id
  from _coinpayments_user_credits as credit
  inner join coinpayments_ipns as ipn on ipn.id = credit.ipn_id
);

-- Checks that:
-- 1. The payment is a ProposePending
-- 2. To the correct user
create or replace function coinpayments_user_credits_pre_insert_update()
returns trigger language plpgsql as
$pgsql$
declare
  ipn coinpayments_ipns;
  payment cm_channel_updates;
begin
  -- Make sure the propose_pending_id does not change once set
  if TG_OP = 'UPDATE' AND OLD.propose_pending_id IS NOT NULL then
    if NEW.propose_pending_id IS DISTINCT FROM OLD.propose_pending_id then
      raise exception 'Update to _coinpayments_user_credits changes propose_pending_id from % to % (old: %, new: %)',
        OLD.propose_pending_id,
        NEW.propose_pending_id,
        OLD,
        NEW;
      end if;
  end if;

  -- Nothing to do if there isn't a ProposePending yet
  if NEW.propose_pending_id IS NULL then
    return NEW;
  end if;

  select *
  from coinpayments_ipns
  where id = NEW.ipn_id
  into ipn;

  select *
  from cm_channel_updates
  where id = NEW.propose_pending_id
  into payment;

  if payment.reason <> 'ProposePendingDeposit' then
    raise exception 'Cannot create a coinpayments_user_credits with a payment that is not a ProposePendingDeposit: % (ipn: %)', payment, ipn;
  end if;

  if ipn.user <> payment.user then
    raise exception 'Cannot create a coinpayments_user_credits where the payments goes to a user different from the IPN. Payment: %, IPN: %', payment, ipn;
  end if;

  return NEW;
end;
$pgsql$;

create trigger coinpayments_user_credits_pre_insert_update
before insert or update on _coinpayments_user_credits
for each row execute procedure coinpayments_user_credits_pre_insert_update();

create or replace function coinpayments_ensure_payment_update_is_not_invalidated()
returns trigger language plpgsql as
$pgsql$
declare
  credit coinpayments_user_credits;
begin
  if NEW.invalid is null then
    return NEW;
  end if;

  select *
  from coinpayments_user_credits
  where propose_pending_id = NEW.id
  into credit;

  if credit is not null then
    -- For now, prevent invalidation of updates associated to a user credit.
    -- If and when this is desierable, it can likely be implemented by nulling
    -- out coinpayments_user_credits.propose_pending_id and letting the poller
    -- create another deposit... but it's not 100% obvious that's desierable
    -- right now, so err on the side of caution and blow up.
    raise exception 'Cannot invalidate an update associated to a coinpayments_user_credits (see comments in trigger). Update: %, credit: %',
      NEW,
      credit;
  end if;

  return NEW;
end;
$pgsql$;

create trigger coinpayments_ensure_payment_update_is_not_invalidated
before insert or update on _cm_channel_updates
for each row execute procedure coinpayments_ensure_payment_update_is_not_invalidated();
