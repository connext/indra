/* Replace with your SQL commands */
/* TODO: replace enum? pain to migrate...*/
create type PAYMENTS_OPTIMISTIC_STATUS as enum (
  'NEW',
  'COMPLETED',
  'FAILED'
);

/* add optimistic payments table */
create table payments_optimistic (
  id bigserial primary key,
  payment_id bigint not null references _payments,
  channel_update_id bigint null references _cm_channel_updates,
  thread_update_id bigint null references _cm_thread_updates,
  redemption_id bigint null references payments_channel_instant,
  status PAYMENTS_OPTIMISTIC_STATUS not null default 'NEW',
  created_on timestamp with time zone not null default now()
);

/* add trigger on insert into table to check status validity */
create or replace function payments_optimistic_pre_insert_update_trigger()
returns trigger language plpgsql as
$pgsql$
declare
  payment payments_optimistic;
begin
  select * from payments_optimistic
  where id = NEW.id
  into payment;

  -- sanity check the status

  -- TODO: what happens if the channel update id is null?
  -- i.e. in the case of threads, should we store the thread open update?

  if payment.redemption_id is not null then 
    if payment.status <> 'COMPLETED' then
      raise exception 'invalid payment status, should be completed if redemption id provided';
    end if;
  end if;

  if payment.thread_update_id is not null then
    if payment.status <> 'COMPLETED' then
      raise exception 'invalid payment status, should be completed if thread id provided';
    end if;
  end if;

  if payment.redemption_id is null then
    if payment.thread_update_id is null then
      if payment.status <> 'NEW' then
        raise exception 'invalid payment status, should be new if it is less than 30 seconds old and unredeemed';
      end if;
    end if;
  end if;

  -- otherwise, should be default status, 'new'
  return NEW;

end;
$pgsql$;

create trigger payments_optimistic_pre_insert_update_trigger
before insert or update on payments_optimistic
for each row execute procedure payments_optimistic_pre_insert_update_trigger();

/* add optimistic payments to view */
create or replace view payments as (
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

    'PT_CHANNEL' as payment_type
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

    'PT_CHANNEL' as payment_type
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

    'PT_CUSTODIAL' as payment_type
  from _payments as p
  inner join payments_channel_custodial as cc on cc.payment_id = p.id
  left join cm_channel_updates as up on up.id = cc.update_id

  union all

  select
    p.id,
    up.created_on,
    up.contract,

    p.purchase_id,
    up.sender,
    p.recipient,

    p.amount_wei,
    p.amount_token,
    p.meta,

    'PT_THREAD' AS payment_type
  from _payments p
  inner join payments_thread as pt on pt.payment_id = p.id
  left join cm_thread_updates up on up.id = pt.update_id

  union all

  select
    p.id,
    up.created_on,
    up.contract,

    p.purchase_id,
    up."user" as sender,
    p.recipient,

    p.amount_wei,
    p.amount_token,
    p.meta,

    'PT_LINK' AS payment_type
  from _payments p
  inner join payments_link as pl on pl.payment_id = p.id
  left join cm_channel_updates up on up.id = pl.update_id

  union all

  select
    p.id,
    up.created_on,
    up.contract,

    p.purchase_id,
    up."user" as sender,
    p.recipient,

    p.amount_wei,
    p.amount_token,
    p.meta,

    'PT_OPTIMISTIC' AS payment_type
  from _payments p
  inner join payments_optimistic as po on po.payment_id = p.id
  left join cm_channel_updates up on up.id = po.channel_update_id
  where po.status in ('NEW', 'FAILED')
);

/* trigger should sanity check the status */
