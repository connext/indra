-- Rename custodial_payments table to payments_channel_instant
-- payments_channel_instant tracks instant channel payments, where the hub
-- is sent a balance ("udpate_id" column), then in the same transaction the hub
-- forwards that balance to the recipient ("disbursement_id" column).
alter table custodial_payments rename to payments_channel_instant;

alter table payments_channel_instant
rename constraint custodial_payments_payment_id_fkey to payments_channel_instant_payment_id_fkey;

alter table payments_channel_instant
rename constraint custodial_payments_disbursement_id_fkey to payments_channel_instant_disbursement_id_fkey;

alter table payments_channel_instant add column update_id bigint unique references _cm_channel_updates(id);
update payments_channel_instant
set update_id = (
  select channel_update_id
  from _payments
  where id = payment_id
);
alter table payments_channel_instant
alter column update_id set not null;

-- Create payments_hub_direct table
-- Tracks payments made directly to the hub.
create table payments_hub_direct (
  id bigserial primary key,
  payment_id bigint unique not null references _payments(id),
  update_id bigint unique not null references _cm_channel_updates(id)
);

-- Create payments_channel_custodial table
-- Tracks custodial payments (ie, payments where user has sent a balance to the
-- hub, and the hub will eventually pay that balance out to the recipient)
create table payments_channel_custodial (
  id bigserial primary key,
  payment_id bigint unique not null references _payments(id),
  update_id bigint unique not null references _cm_channel_updates(id)
);

create or replace function payments_channel_custodial_pre_insert_update_check()
returns trigger language plpgsql as
$pgsql$
declare
  p _payments;
  up cm_channel_updates;
begin
  select *
  from _payments
  where id = NEW.payment_id
  into p;

  select *
  from cm_channel_updates
  where id = NEW.update_id
  into up;

  if up.reason is distinct from 'Payment' then
    raise exception 'update % is not a payment: %', NEW.update_id, up;
  end if;

  if
    up.args->>'amountToken' is distinct from p.amount_token::text or
    up.args->>'amountWei' is distinct from p.amount_wei::text
  then
    raise exception 'payment amount does not match update payment. Payment: %, update: %',
      p,
      up;
  end if;

  return NEW;
end;
$pgsql$;

create trigger payments_channel_custodial_pre_insert_update_check
before insert or update on payments_channel_custodial
for each row execute procedure payments_channel_custodial_pre_insert_update_check();

-- Update the _payments table and view
drop view payments;
alter table _payments drop constraint _payments_check;
alter table _payments drop column channel_update_id;
alter table _payments drop column thread_update_id;

-- REB-36: create a payments_thread table

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

    'channel-instant' as payment_type
  from _payments as p
  inner join payments_channel_instant as ci on ci.payment_id = p.id
  left join cm_channel_updates as up on up.id = ci.update_id

  union all

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

    'hub-direct' as payment_type
  from _payments as p
  inner join payments_hub_direct as ph on ph.payment_id = p.id
  left join cm_channel_updates as up on up.id = ph.update_id

  union all

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

    'channel-custodial' as payment_type
  from _payments as p
  inner join payments_channel_custodial as cc on cc.payment_id = p.id
  left join cm_channel_updates as up on up.id = cc.update_id

  -- REB-36: "union all" in the payments_thread table here
);


create table _custodial_withdrawals (
  id bigserial primary key,
  created_on timestamp with time zone not null default now(),
  "user" csw_eth_address not null,
  recipient csw_eth_address not null,
  requested_token token_amount,
  exchange_rate numeric,
  sent_wei wei_amount,
  onchain_tx_id bigint not null references onchain_transactions_raw (id)
);

create view custodial_withdrawals as (
  select
    w.id,
    w.created_on,
    w."user",
    w.recipient,
    w.requested_token,
    w.exchange_rate,
    w.sent_wei,
    tx.state,
    tx.hash as tx_hash,
    w.onchain_tx_id
  from _custodial_withdrawals as w
  left join onchain_transactions_raw as tx on tx.id = onchain_tx_id
);

-- TODO: I don't know for certain, but I suspect this might have terrible performance.
-- We can test it out when the rest of the system is ready, then decide if it's worth
-- replacing with a concrete table + triggers to maintain the balances.
create view custodial_balances as (
  select
    "user",
    sum(amount_wei) as total_received_wei,
    sum(amount_token) as total_received_token,
    sum(requested_wei) as total_withdrawn_wei,
    sum(requested_token) as total_withdrawn_token,
    sum(amount_wei) - sum(requested_wei) as balance_wei,
    sum(amount_token) - sum(requested_token) as balance_token,
    sum(sent_wei) as sent_wei

  from (
    select
      recipient as "user",
      amount_wei,
      amount_token,
      0 as requested_wei,
      0 as requested_token,
      0 as sent_wei
    from payments_channel_custodial as ip
    left join payments as p on p.id = ip.payment_id

    union all
    
    select
      "user",
      0 as amount_wei,
      0 as amount_token,
      0 as requested_wei,
      requested_token,
      sent_wei
    from custodial_withdrawals
    where state is distinct from 'failed'
  ) as x
  group by 1
);

create or replace function custodial_withdrawals_post_insert_update_check_trigger()
returns trigger language plpgsql as
$pgsql$
declare
  balance custodial_balances;
  tx onchain_transactions_raw;
begin
  if TG_OP = 'UPDATE' then
    raise exception 'withdrawals should not be updated!';
  end if;

  if abs(NEW.sent_wei - (NEW.requested_token / NEW.exchange_rate)) > NEW.exchange_rate then
    raise exception 'withdrawal sent_wei does not match requested_token / exchange_rate: sent_wei: %; requested_token / exchange_rate: %; row: %',
      NEW.sent_wei,
      NEW.requested_token / NEW.exchange_rate,
      NEW;
  end if;
  
  select *
  from custodial_balances
  where "user" = NEW.user
  into balance;
  
  if balance.balance_wei < 0 or balance.balance_token < 0 then
    raise exception 'withdrawal reduces balance of % below 0. Balance: %; withdrawal: %.',
      NEW."user",
      balance,
      NEW;
  end if;

  select *
  from onchain_transactions_raw
  where id = NEW.onchain_tx_id
  into tx;

  if tx.value is distinct from NEW.sent_wei then
    raise exception 'withdrawal transaction value does not match withdrawal amount. tx: %; withdrawal: %.',
      tx,
      NEW;
  end if;

  return NEW;
end;
$pgsql$;

create trigger custodial_withdrawals_post_insert_update_check_trigger
after insert or update on _custodial_withdrawals
for each row execute procedure custodial_withdrawals_post_insert_update_check_trigger();
